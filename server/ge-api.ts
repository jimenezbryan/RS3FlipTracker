import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateSmartPricing, getPriceTier } from "./technical-indicators";
import { UNCATEGORISED } from "@shared/scannerFilters";

/**
 * Jagex's GE categories, built by scripts/refresh-categories.ts. Read once, server-side only —
 * it is ~7,000 entries and has no business in the client bundle, so the category rides along
 * on each scanner row instead.
 *
 * Missing or unreadable is not an error: every item falls back to "Uncategorised" and the
 * filter keeps working. That matters because the file is refreshed by hand and will lag new
 * items by design.
 */
const itemCategories: Record<string, string> = (() => {
  try {
    return JSON.parse(readFileSync(join(import.meta.dirname, "..", "shared", "itemCategories.json"), "utf8"));
  } catch {
    console.warn("[ge-api] shared/itemCategories.json missing — run scripts/refresh-categories.ts");
    return {};
  }
})();

// Current prices, volume and buy limits come from the RuneScape Wiki real-time API.
// ponytail: its RS3 dataset only starts 2026-07-23, so anything needing more than a
// couple of weeks of history still comes from WeirdGloop below. Around 2026-10-23 the
// wiki will have 90 days and getItemTrend/getItemSuggestions/getItemPriceHistory("daily")
// can move to /timeseries?lookback=30d|6m. Calendar switch, not an abstraction.
const WIKI_API_BASE = "https://prices.runescape.wiki/api/v2/rs";
const GE_API_BASE = "https://api.weirdgloop.org/exchange/history/rs";
const RS_ITEMDB_BASE = "https://secure.runescape.com/m=itemdb_rs";

// The wiki blocks unhelpful user agents (curl/*, python-requests, Java/*) and asks for a
// contact address. This is the only thing they require of API consumers.
export const USER_AGENT =
  "RS3FlipTracker/2.0 (RS3 Grand Exchange flip tracker; bjimenez@virtualsyncsolutions.com)";

export interface GEItem {
  id: number;
  name: string;
  /** Mid price, round((high + low) / 2). Drop-in for the old guide price. */
  price: number;
  /** Instant-buy. Additive — the client re-declares this type in several files, so
   *  adding fields is safe but renaming `price` would not be. */
  high?: number;
  /** Instant-sell. */
  low?: number;
  highTime?: number;
  lowTime?: number;
  volume?: number;
  timestamp?: string;
  icon?: string;
  isMembers?: boolean;
  geLimit?: number;
  examine?: string;
}

export interface PriceTrend {
  direction: "rising" | "falling" | "stable";
  changePercent: number;
  changeAmount: number;
  trendDays: number;
  avgPrice7d: number;
  avgPrice30d: number;
  lowPrice30d: number;
  highPrice30d: number;
  recommendation: "buy" | "sell" | "hold";
  recommendationReason: string;
}

interface CachedItem {
  id: number;
  name: string;
  nameLower: string;
  isMembers?: boolean;
  geLimit?: number;
  examine?: string;
}

interface CachedPrice {
  price: number;        // mid — the drop-in for WeirdGloop's guide price
  high?: number;        // instant-buy
  low?: number;         // instant-sell
  highTime?: number;    // unix ms
  lowTime?: number;     // unix ms
  hourHigh?: number;    // hourly average instant-buy — outlier-resistant
  hourLow?: number;     // hourly average instant-sell
  hourVolume?: number;  // min(high, low) volume traded this hour; 0 if one-sided
  volume?: number;
  isMembers?: boolean;
  geLimit?: number;
  examine?: string;
}

let itemCache: CachedItem[] = [];
let itemPriceCache: Map<number, CachedPrice> = new Map();
let itemIdByNameLower: Map<string, number> = new Map();

/** Round to whole gp. The wiki's /1h, /5m and /timeseries averages carry decimals, and
 *  every price column is bigint — Postgres rejects 786.4. Applied at this seam so no
 *  caller has to remember. Sub-1gp precision is meaningless in the GE. */
function gp(n: number | null | undefined): number | null {
  return n == null || !Number.isFinite(n) ? null : Math.round(n);
}

/** Per-instance TTL memo with two properties a plain cache lacks:
 *  - inflight dedupe, so a cold lambda serving concurrent requests fetches /mapping once
 *  - serve-stale-on-error, so a wiki blip degrades instead of 500ing the scanner
 *  ponytail: no cron, no snapshot table. A cold start re-fetches ~1MB in ~0.6s parallel,
 *  which is cheaper than the 2.3MB dump this replaced. Revisit only if the wiki starts
 *  rate-limiting or /latest grows past a few MB. */
function memo<T>(ttlMs: number, fetcher: () => Promise<T>): () => Promise<T> {
  let value: T | undefined;
  let at = 0;
  let inflight: Promise<T> | undefined;

  return async () => {
    if (value !== undefined && Date.now() - at < ttlMs) return value;
    if (!inflight) {
      inflight = fetcher()
        .then((v) => {
          value = v;
          at = Date.now();
          inflight = undefined;
          return v;
        })
        .catch((err) => {
          inflight = undefined;
          if (value !== undefined) {
            console.error("[ge-api] refresh failed, serving stale:", err);
            return value;
          }
          throw err;
        });
    }
    return inflight;
  };
}

async function wikiFetch(path: string): Promise<any> {
  const res = await fetch(`${WIKI_API_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`wiki ${path} -> ${res.status}`);
  return res.json();
}

export interface MappingEntry {
  id: number;
  name: string;
  examine?: string;
  members?: boolean;
  limit?: number;
  /** High Alchemy value. Absent on ~1,300 of 7,322 items (untradeable-for-alch, quest items). */
  highalch?: number;
  lowalch?: number;
}

/** ~7300 items. Only changes on game-update days. */
export const getMapping = memo<MappingEntry[]>(24 * 60 * 60 * 1000, () => wikiFetch("/mapping"));

/** Real instant-buy/instant-sell for every item, one call. */
export const getLatest = memo<Record<string, { high: number | null; highTime: number | null; low: number | null; lowTime: number | null }>>(
  60 * 1000,
  async () => (await wikiFetch("/latest")).data ?? {},
);

/** Real 24h traded volume per item. */
export const getVolumes = memo<Record<string, number>>(5 * 60 * 1000, async () => {
  const body = await wikiFetch("/volumes");
  return body.data ?? {};
});

export interface HourlyTick {
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

/** Hourly averages. Preferred over /latest for margins: /latest reports the last single
 *  trade on each side, so one mis-clicked buy turns a 200gp item into a 999,800 "margin".
 *  Averaging over an hour of real trades removes that. Only ~840 items trade both sides
 *  in a given hour, hence the /latest fallback. */
export const getHourly = memo<Record<string, HourlyTick>>(
  5 * 60 * 1000,
  async () => (await wikiFetch("/1h")).data ?? {},
);

/** Hour-aligned unix seconds, N hours back. The /1h endpoint indexes whole-hour blocks. */
function hourBlockAgo(hours: number): number {
  const seconds = Math.floor(Date.now() / 1000) - hours * 3600;
  return Math.floor(seconds / 3600) * 3600;
}

/** The same hourly block 24h ago — the anchor for a real price trend, replacing a
 *  "trend" that was derived from the fabricated margin and so never varied. */
export const getHourly24hAgo = memo<Record<string, HourlyTick>>(
  5 * 60 * 1000,
  async () => (await wikiFetch(`/1h?timestamp=${hourBlockAgo(24)}`)).data ?? {},
);

/** Same block 7 days back, for the 7d movers column. */
const getHourly7dAgo = memo<Record<string, HourlyTick>>(
  15 * 60 * 1000,
  async () => (await wikiFetch(`/1h?timestamp=${hourBlockAgo(24 * 7)}`)).data ?? {},
);

/** Mid of an hourly block, or null if it didn't trade. */
function hourlyMid(tick: HourlyTick | undefined): number | null {
  if (!tick) return null;
  const hi = tick.avgHighPrice;
  const lo = tick.avgLowPrice;
  if (hi != null && lo != null) return Math.round((hi + lo) / 2);
  return gp(hi ?? lo);
}

const CACHE_TTL = 60 * 1000;
let cacheLastUpdated = 0;

/** ponytail: a quote older than this is not tradeable, so its spread is not a margin.
 *  Widen it if the scanner feels too sparse — 24h keeps ~3900 items, 72h ~4900. */
const SCANNER_MAX_QUOTE_AGE_MS = 24 * 60 * 60 * 1000;

/** ponytail: spread sanity cap, as a fraction of the buy price. Real GE margins are low
 *  single digits; 50%+ means a manipulated or mis-clicked trade, not an opportunity.
 *  Lower it toward 0.2 if artifacts still surface at the top of the profit sort. */
const SCANNER_MAX_SPREAD_RATIO = 0.5;

async function refreshItemCache(): Promise<void> {
  const now = Date.now();
  if (itemCache.length > 0 && now - cacheLastUpdated < CACHE_TTL) {
    return;
  }

  try {
    const [mapping, latest, volumes, hourly] = await Promise.all([
      getMapping(),
      getLatest(),
      getVolumes(),
      getHourly(),
    ]);

    // ponytail: keyed by id, not an array, because /mapping ships the same id twice for a
    // dozen items — a base name and a tier alias ("Deathdealer robe top" and
    // "Deathdealer robe top (tier 90)") sharing id 55468 and identical prices. Pushing both
    // gave the scanner two rows with the same React key, which broke reconciliation: rows
    // went stale and survived filter changes, so every filter looked broken at once.
    // On a collision keep the shorter name — that is the base item, which is what the GE
    // shows and what people search for.
    const byId = new Map<number, CachedItem>();
    const prices = new Map<number, CachedPrice>();
    const idsByName = new Map<string, number>();

    for (const entry of mapping) {
      if (!entry?.id || !entry.name) continue;

      const nameLower = entry.name.toLowerCase();
      const existing = byId.get(entry.id);
      if (!existing || entry.name.length < existing.name.length) {
        byId.set(entry.id, {
          id: entry.id,
          name: entry.name,
          nameLower,
          isMembers: entry.members,
          geLimit: entry.limit,
          examine: entry.examine,
        });
      }
      if (!idsByName.has(nameLower)) idsByName.set(nameLower, entry.id);

      const tick = latest[String(entry.id)];
      const high = gp(tick?.high);
      const low = gp(tick?.low);
      // Mid is the drop-in for the old guide price. One-sided books still get a usable
      // number; items with no trades at all are simply absent, as they were before.
      const mid = high != null && low != null ? Math.round((high + low) / 2) : (high ?? low);
      if (mid == null || mid <= 0) continue;

      const hr = hourly[String(entry.id)];
      const hourHigh = gp(hr?.avgHighPrice);
      const hourLow = gp(hr?.avgLowPrice);

      prices.set(entry.id, {
        price: mid,
        high: high ?? undefined,
        low: low ?? undefined,
        highTime: tick?.highTime ? tick.highTime * 1000 : undefined,
        lowTime: tick?.lowTime ? tick.lowTime * 1000 : undefined,
        hourHigh: hourHigh ?? undefined,
        hourLow: hourLow ?? undefined,
        hourVolume:
          hr && hr.highPriceVolume > 0 && hr.lowPriceVolume > 0
            ? Math.min(hr.highPriceVolume, hr.lowPriceVolume)
            : 0,
        volume: volumes[String(entry.id)] ?? 0,
        isMembers: entry.members,
        geLimit: entry.limit,
        examine: entry.examine,
      });
    }

    itemCache = Array.from(byId.values());
    itemPriceCache = prices;
    itemIdByNameLower = idsByName;
    cacheLastUpdated = now;
    console.log(
      `[ge-api] Cached ${itemCache.length} items (${mapping.length} mapping entries), ${prices.size} priced`,
    );
  } catch (error) {
    console.error("[ge-api] Failed to refresh item cache:", error);
  }
}

function fuzzyMatch(query: string, name: string): number {
  const queryLower = query.toLowerCase();
  const nameLower = name.toLowerCase();
  
  if (nameLower === queryLower) return 100;
  if (nameLower.startsWith(queryLower)) return 90;
  
  const words = nameLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(queryLower)) return 80;
  }
  
  if (nameLower.includes(queryLower)) return 70;
  
  return 0;
}

export async function searchItems(query: string): Promise<GEItem[]> {
  await refreshItemCache();
  
  if (query.length < 2) return [];
  
  const queryLower = query.toLowerCase();
  const matches: { item: CachedItem; score: number }[] = [];
  
  for (const item of itemCache) {
    const score = fuzzyMatch(queryLower, item.name);
    if (score > 0) {
      matches.push({ item, score });
    }
  }
  
  matches.sort((a, b) => b.score - a.score);
  
  const results: GEItem[] = [];
  for (const { item } of matches.slice(0, 15)) {
    const priceData = itemPriceCache.get(item.id);
    if (priceData && priceData.price > 0) {
      results.push({
        id: item.id,
        name: item.name,
        price: priceData.price,
        high: priceData.high,
        low: priceData.low,
        volume: priceData.volume,
        icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
        isMembers: item.isMembers,
        geLimit: item.geLimit,
        examine: item.examine,
      });
    }
  }
  
  return results;
}

export async function getItemPrice(itemName: string): Promise<GEItem | null> {
  try {
    await refreshItemCache();

    // Resolved entirely from the cached mapping now — this used to hit WeirdGloop's
    // /latest?name=, which was the app's second name->id mechanism and could disagree
    // with the local fuzzy scan. One source now.
    const wanted = itemName.toLowerCase();
    let itemId = itemIdByNameLower.get(wanted);

    if (itemId === undefined) {
      const best = await searchItems(itemName);
      if (best.length === 0) return null;
      itemId = best[0].id;
    }

    const cachedData = itemPriceCache.get(itemId);
    if (!cachedData) return null;

    const item = itemCache.find((i) => i.id === itemId);

    return {
      id: itemId,
      name: item?.name ?? itemName,
      price: cachedData.price,
      high: cachedData.high,
      low: cachedData.low,
      highTime: cachedData.highTime,
      lowTime: cachedData.lowTime,
      volume: cachedData.volume,
      timestamp: cachedData.highTime ? new Date(cachedData.highTime).toISOString() : undefined,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
      isMembers: cachedData.isMembers,
      geLimit: cachedData.geLimit,
      examine: cachedData.examine,
    };
  } catch (error) {
    console.error("Failed to fetch GE price:", error);
    return null;
  }
}

export async function getItemTrend(itemId: number): Promise<PriceTrend | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/last90d?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const history = data[itemId.toString()];
    
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort(
      (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const prices = sortedHistory.map((h: any) => h.price);
    const currentPrice = prices[prices.length - 1];
    
    const last7d = prices.slice(-7);
    const last30d = prices.slice(-30);
    
    const avgPrice7d = last7d.reduce((a: number, b: number) => a + b, 0) / last7d.length;
    const avgPrice30d = last30d.reduce((a: number, b: number) => a + b, 0) / last30d.length;
    const lowPrice30d = Math.min(...last30d);
    const highPrice30d = Math.max(...last30d);
    
    let trendDays = 0;
    let trendDirection: "rising" | "falling" | "stable" = "stable";
    
    if (prices.length >= 2) {
      const recentPrice = prices[prices.length - 1];
      let lastTrendPrice = recentPrice;
      
      for (let i = prices.length - 2; i >= 0; i--) {
        const diff = recentPrice - prices[i];
        const percentDiff = Math.abs(diff / prices[i]) * 100;
        
        if (percentDiff < 2) {
          trendDays++;
          continue;
        }
        
        if (trendDays === 0) {
          trendDirection = diff > 0 ? "rising" : "falling";
          trendDays = 1;
          lastTrendPrice = prices[i];
        } else {
          const currentTrend = diff > 0 ? "rising" : "falling";
          if (currentTrend === trendDirection) {
            trendDays++;
            lastTrendPrice = prices[i];
          } else {
            break;
          }
        }
      }
    }
    
    const priceWeekAgo = prices[Math.max(0, prices.length - 8)] || currentPrice;
    const changeAmount = currentPrice - priceWeekAgo;
    const changePercent = (changeAmount / priceWeekAgo) * 100;
    
    let recommendation: "buy" | "sell" | "hold" = "hold";
    let recommendationReason = "";
    
    const priceVsLow = ((currentPrice - lowPrice30d) / lowPrice30d) * 100;
    const priceVsHigh = ((highPrice30d - currentPrice) / highPrice30d) * 100;
    const priceVs30dAvg = ((currentPrice - avgPrice30d) / avgPrice30d) * 100;
    
    if (priceVsLow < 10 && trendDirection !== "falling") {
      recommendation = "buy";
      recommendationReason = `Near 30-day low (${priceVsLow.toFixed(1)}% above). Good entry point.`;
    } else if (priceVsHigh < 10 && trendDirection !== "rising") {
      recommendation = "sell";
      recommendationReason = `Near 30-day high (${priceVsHigh.toFixed(1)}% below). Consider selling.`;
    } else if (trendDirection === "falling" && trendDays >= 5) {
      recommendation = "hold";
      recommendationReason = `Falling for ${trendDays} days. Wait for stabilization.`;
    } else if (trendDirection === "rising" && trendDays >= 5 && priceVs30dAvg < 5) {
      recommendation = "buy";
      recommendationReason = `Rising trend for ${trendDays} days, still near average.`;
    } else if (priceVs30dAvg < -5) {
      recommendation = "buy";
      recommendationReason = `${Math.abs(priceVs30dAvg).toFixed(1)}% below 30-day average.`;
    } else if (priceVs30dAvg > 10) {
      recommendation = "sell";
      recommendationReason = `${priceVs30dAvg.toFixed(1)}% above 30-day average.`;
    } else {
      recommendation = "hold";
      recommendationReason = "Price is within normal range. Monitor for opportunities.";
    }

    return {
      direction: trendDirection,
      changePercent: Math.round(changePercent * 100) / 100,
      changeAmount: Math.round(changeAmount),
      trendDays: Math.max(1, trendDays),
      avgPrice7d: Math.round(avgPrice7d),
      avgPrice30d: Math.round(avgPrice30d),
      lowPrice30d: Math.round(lowPrice30d),
      highPrice30d: Math.round(highPrice30d),
      recommendation,
      recommendationReason,
    };
  } catch (error) {
    console.error("Failed to fetch item trend:", error);
    return null;
  }
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  volume?: number;
  /** Instant-buy / instant-sell for the block. Only the intraday source carries these —
   *  WeirdGloop's daily history has a single guide price and leaves them undefined. */
  high?: number;
  low?: number;
}

function parseTimestamp(h: any): string {
  if (typeof h.timestamp === 'number') {
    const ts = h.timestamp > 9999999999 ? h.timestamp : h.timestamp * 1000;
    return new Date(ts).toISOString().split('T')[0];
  } else if (typeof h.timestamp === 'string') {
    if (h.timestamp.includes('T')) {
      return h.timestamp.split('T')[0];
    }
    return new Date(h.timestamp).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export type ChartPeriod = "24h" | "7d" | "daily" | "weekly" | "monthly" | "yearly";

/** Intraday history. WeirdGloop only stores one point per day, so anything shorter than a
 *  day has to come from the wiki's /timeseries.
 *
 *  ponytail: ONE upstream request serves both intraday views. lookback=7d returns ~167
 *  hourly blocks and lookback=1d is not a valid value (the API 400s), so 24H is the tail of
 *  the 7D series rather than its own fetch. Note `timestep=` is the OSRS parameter — the RS3
 *  API takes `lookback` and rejects the other. */
const INTRADAY_TTL = 5 * 60 * 1000;
const intradayCache = new Map<number, () => Promise<PriceHistoryPoint[]>>();

export async function getItemIntraday(
  itemId: number,
  hours: number,
): Promise<PriceHistoryPoint[] | null> {
  let cached = intradayCache.get(itemId);
  if (!cached) {
    // memo() gives inflight dedupe and serve-stale-on-error, both of which matter here:
    // a Scanner drawer and the Home chart can ask for the same item at once.
    cached = memo<PriceHistoryPoint[]>(INTRADAY_TTL, async () => {
      const body = await wikiFetch(`/timeseries?id=${itemId}&lookback=7d`);
      const rows: any[] = body?.data ?? [];
      const points: PriceHistoryPoint[] = [];
      for (const r of rows) {
        const high = gp(r.avgHighPrice);
        const low = gp(r.avgLowPrice);
        // Mid where both sides traded, otherwise whichever side did. Same rule as
        // refreshItemCache, so the chart and the scanner agree on what "price" means.
        const price = high != null && low != null ? Math.round((high + low) / 2) : (high ?? low);
        if (price == null || price <= 0) continue;
        points.push({
          date: new Date(r.timestamp * 1000).toISOString(),
          price,
          // Two-sided volume, matching hourVolume in the scanner cache.
          volume: Math.min(r.highPriceVolume ?? 0, r.lowPriceVolume ?? 0),
          high: high ?? undefined,
          low: low ?? undefined,
        });
      }
      return points;
    });
    intradayCache.set(itemId, cached);
  }
  const fetcher = cached;

  try {
    const series = await fetcher();
    if (series.length === 0) return null;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const window = series.filter((p) => new Date(p.date).getTime() >= cutoff);
    // A thinly traded item can have no block inside the last 24h. Returning the untrimmed
    // series would silently mislabel week-old prices as today's, so say nothing instead.
    return window.length > 0 ? window : null;
  } catch (error) {
    console.error(`[ge-api] intraday fetch failed for ${itemId}:`, error);
    return null;
  }
}

export async function getItemPriceHistory(itemId: number, period: ChartPeriod = "daily"): Promise<PriceHistoryPoint[] | null> {
  try {
    const useAllHistory = period === "weekly" || period === "monthly" || period === "yearly";
    const endpoint = useAllHistory ? "all" : "last90d";
    
    const response = await fetch(
      `${GE_API_BASE}/${endpoint}?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const history = data[itemId.toString()];
    
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort(
      (a: any, b: any) => {
        const tsA = typeof a.timestamp === 'number' ? (a.timestamp > 9999999999 ? a.timestamp : a.timestamp * 1000) : new Date(a.timestamp).getTime();
        const tsB = typeof b.timestamp === 'number' ? (b.timestamp > 9999999999 ? b.timestamp : b.timestamp * 1000) : new Date(b.timestamp).getTime();
        return tsA - tsB;
      }
    );

    const allPoints: PriceHistoryPoint[] = sortedHistory.map((h: any) => ({
      date: parseTimestamp(h),
      price: h.price,
      volume: h.volume,
    }));

    const now = new Date();
    let cutoffDate: Date;
    switch (period) {
      case "daily":
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        cutoffDate = new Date(0);
        break;
    }

    const filteredPoints = allPoints.filter(p => new Date(p.date) >= cutoffDate);

    if (period === "weekly") {
      return aggregateToWeekly(filteredPoints);
    } else if (period === "monthly") {
      return aggregateToMonthly(filteredPoints);
    } else if (period === "yearly") {
      return aggregateToMonthly(filteredPoints);
    }

    return filteredPoints;
  } catch (error) {
    console.error("Failed to fetch item price history:", error);
    return null;
  }
}

function aggregateToWeekly(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  const weeks = new Map<string, { prices: number[]; volumes: number[] }>();
  for (const p of points) {
    const d = new Date(p.date);
    const day = d.getDay();
    const weekStart = new Date(d.getTime() - day * 24 * 60 * 60 * 1000);
    const key = weekStart.toISOString().split('T')[0];
    if (!weeks.has(key)) weeks.set(key, { prices: [], volumes: [] });
    const w = weeks.get(key)!;
    w.prices.push(p.price);
    if (p.volume) w.volumes.push(p.volume);
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      price: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
      volume: data.volumes.length > 0 ? Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length) : undefined,
    }));
}

function aggregateToMonthly(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  const months = new Map<string, { prices: number[]; volumes: number[] }>();
  for (const p of points) {
    const key = p.date.substring(0, 7) + "-01";
    if (!months.has(key)) months.set(key, { prices: [], volumes: [] });
    const m = months.get(key)!;
    m.prices.push(p.price);
    if (p.volume) m.volumes.push(p.volume);
  }
  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      price: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
      volume: data.volumes.length > 0 ? Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length) : undefined,
    }));
}

export async function getItemPriceHistoryFull(itemId: number): Promise<{ monthly: PriceHistoryPoint[]; daily: PriceHistoryPoint[] } | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/all?id=${itemId}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const history = data[itemId.toString()];
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort(
      (a: any, b: any) => {
        const tsA = typeof a.timestamp === 'number' ? (a.timestamp > 9999999999 ? a.timestamp : a.timestamp * 1000) : new Date(a.timestamp).getTime();
        const tsB = typeof b.timestamp === 'number' ? (b.timestamp > 9999999999 ? b.timestamp : b.timestamp * 1000) : new Date(b.timestamp).getTime();
        return tsA - tsB;
      }
    );

    const allPoints: PriceHistoryPoint[] = sortedHistory.map((h: any) => ({
      date: parseTimestamp(h),
      price: h.price,
      volume: h.volume,
    }));

    const monthly = aggregateToMonthly(allPoints);

    const now = new Date();
    const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const daily = allPoints.filter(p => new Date(p.date) >= cutoff90d);

    return { monthly, daily };
  } catch (error) {
    console.error("Failed to fetch full item price history:", error);
    return null;
  }
}

export interface PriceSuggestion {
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  potentialProfit: number;
  potentialROI: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  buyReason: string;
  sellReason: string;
  currentPrice: number;
  avgPrice7d: number;
  avgPrice30d: number;
  lowPrice30d: number;
  highPrice30d: number;
  volatility: number;
  trend: "rising" | "falling" | "stable";
}

export async function getItemSuggestions(itemId: number): Promise<PriceSuggestion | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/last90d?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const history = data[itemId.toString()];
    
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort(
      (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const prices = sortedHistory.map((h: any) => h.price);
    const currentPrice = prices[prices.length - 1];
    
    const last7d = prices.slice(-7);
    const last30d = prices.slice(-30);
    const last14d = prices.slice(-14);
    
    const avgPrice7d = last7d.reduce((a: number, b: number) => a + b, 0) / last7d.length;
    const avgPrice30d = last30d.reduce((a: number, b: number) => a + b, 0) / last30d.length;
    const avgPrice14d = last14d.reduce((a: number, b: number) => a + b, 0) / last14d.length;
    const lowPrice30d = Math.min(...last30d);
    const highPrice30d = Math.max(...last30d);
    
    // Calculate volatility (standard deviation / mean)
    const mean30d = avgPrice30d;
    const squaredDiffs = last30d.map((p: number) => Math.pow(p - mean30d, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a: number, b: number) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    const volatility = (stdDev / mean30d) * 100;
    
    // Determine trend
    let trend: "rising" | "falling" | "stable" = "stable";
    const priceChange7d = ((currentPrice - avgPrice7d) / avgPrice7d) * 100;
    if (priceChange7d > 3) trend = "rising";
    else if (priceChange7d < -3) trend = "falling";
    
    // Calculate suggested buy price
    // Strategy: Buy below 7-day average, closer to 30-day low for high-volatility items
    let buyDiscount = 0.05; // Base 5% discount from current price
    if (volatility > 10) buyDiscount = 0.08; // Higher discount for volatile items
    if (volatility > 20) buyDiscount = 0.12;
    if (trend === "falling") buyDiscount += 0.03; // Extra discount when falling
    
    // Target buy price between current and 30-day low
    const targetBuyFromLow = lowPrice30d + (avgPrice30d - lowPrice30d) * 0.3; // 30% above 30-day low
    const targetBuyFromCurrent = currentPrice * (1 - buyDiscount);
    const suggestedBuyPrice = Math.round(Math.max(
      lowPrice30d * 1.02, // At least 2% above 30-day low (realistic)
      Math.min(targetBuyFromLow, targetBuyFromCurrent)
    ));
    
    // Calculate suggested sell price
    // Strategy: Sell above 7-day average, closer to 30-day high
    let sellPremium = 0.05; // Base 5% premium
    if (volatility > 10) sellPremium = 0.08;
    if (volatility > 20) sellPremium = 0.12;
    if (trend === "rising") sellPremium += 0.02;
    
    const targetSellFromHigh = highPrice30d - (highPrice30d - avgPrice30d) * 0.3; // 30% below 30-day high
    const targetSellFromCurrent = currentPrice * (1 + sellPremium);
    const suggestedSellPrice = Math.round(Math.min(
      highPrice30d * 0.98, // At most 2% below 30-day high (realistic)
      Math.max(targetSellFromHigh, targetSellFromCurrent)
    ));
    
    // Calculate potential profit
    const potentialProfit = suggestedSellPrice - suggestedBuyPrice;
    const potentialROI = ((suggestedSellPrice - suggestedBuyPrice) / suggestedBuyPrice) * 100;
    
    // Determine confidence level
    let confidence: "high" | "medium" | "low" = "medium";
    let confidenceReason = "";
    
    // High confidence when volatility is moderate and we have good spread
    if (volatility >= 5 && volatility <= 15 && potentialROI >= 8) {
      confidence = "high";
      confidenceReason = "Good price range with moderate volatility. Historical patterns suggest reliable flip opportunities.";
    } else if (volatility > 20) {
      confidence = "low";
      confidenceReason = "High price volatility. Prices may swing unexpectedly. Consider smaller positions.";
    } else if (potentialROI < 5) {
      confidence = "low";
      confidenceReason = "Narrow profit margin. Transaction costs and price movements may reduce actual profit.";
    } else if (trend === "falling" && currentPrice > avgPrice30d) {
      confidence = "medium";
      confidenceReason = "Price declining but still above average. Wait for better entry point or use suggested buy price.";
    } else if (trend === "rising" && currentPrice < avgPrice30d) {
      confidence = "high";
      confidenceReason = "Price rising from below average. Good momentum for flipping.";
    } else {
      confidenceReason = "Standard market conditions. Suggested prices based on 30-day trading range.";
    }
    
    // Generate buy/sell reasons
    const buyReason = suggestedBuyPrice < avgPrice7d
      ? `${((avgPrice7d - suggestedBuyPrice) / avgPrice7d * 100).toFixed(1)}% below 7-day avg (${formatPriceSimple(avgPrice7d)} gp)`
      : `Near recent low of ${formatPriceSimple(lowPrice30d)} gp`;
    
    const sellReason = suggestedSellPrice > avgPrice7d
      ? `${((suggestedSellPrice - avgPrice7d) / avgPrice7d * 100).toFixed(1)}% above 7-day avg, targeting ${formatPriceSimple(highPrice30d)} gp high`
      : `Based on ${formatPriceSimple(highPrice30d)} gp 30-day high`;

    return {
      suggestedBuyPrice,
      suggestedSellPrice,
      potentialProfit,
      potentialROI: Math.round(potentialROI * 100) / 100,
      confidence,
      confidenceReason,
      buyReason,
      sellReason,
      currentPrice,
      avgPrice7d: Math.round(avgPrice7d),
      avgPrice30d: Math.round(avgPrice30d),
      lowPrice30d,
      highPrice30d,
      volatility: Math.round(volatility * 100) / 100,
      trend,
    };
  } catch (error) {
    console.error("Failed to calculate item suggestions:", error);
    return null;
  }
}

function formatPriceSimple(price: number): string {
  if (price >= 1000000000) return `${(price / 1000000000).toFixed(1)}B`;
  if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `${(price / 1000).toFixed(1)}K`;
  return price.toLocaleString();
}

export interface ScannerItem {
  id: number;
  name: string;
  icon: string;
  isMembers: boolean;
  geLimit: number;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  volume: number;
  /** Two-sided volume in the last hourly block; 0 when only one side traded. The
   *  "can I flip this right now" number — 24h volume can be a single burst. */
  hourVolume: number;
  /** Units you can realistically clear in one 4h buy-limit window:
   *  min(geLimit, volume / 6). Every profit figure below is scaled to this. */
  fillQty: number;
  potentialProfit: number;
  marginVolume: number;
  roi: number;
  netProfit: number;
  capitalEfficiency: number;
  trend: "up" | "down" | "stable";
  // ponytail: the signed 24h move behind `trend`. The bucket alone cannot say whether a
  // move was 1.1% or 40%, so signal thresholds had nothing to gate on but direction.
  // null when the item has no hourly block 24h ago to compare against.
  changePct24h: number | null;
  /** Jagex's own GE category, e.g. "Seeds". "Uncategorised" when the catalogue has not been
   *  refreshed since the item shipped — never absent, so it stays filterable either way. */
  category: string;
  volatility: "low" | "medium" | "high";
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  suggestedMarginPct: number;
  priceTier: "low" | "mid" | "high" | "ultra";
  confidence: "low" | "medium" | "high";
  range7dLow: number | null;
  range7dHigh: number | null;
  range7dSpreadPct: number | null;
}

export async function getAllItemsForScanner(): Promise<ScannerItem[]> {
  await refreshItemCache();
  const yesterday = await getHourly24hAgo();

  const results: ScannerItem[] = [];
  
  for (const item of itemCache) {
    const priceData = itemPriceCache.get(item.id);
    if (!priceData || priceData.price <= 0) continue;
    
    const price = priceData.price;
    const geLimit = item.geLimit ?? 0;
    const volume = priceData.volume ?? 0;

    // Margin source, best first. /latest reports the last single trade on each side, so
    // one mis-clicked buy becomes a 999,800 "margin" on a 200gp item. The hourly average
    // is immune to that but only ~840 items trade both sides in a given hour, so /latest
    // (with a freshness guard) covers the rest.
    let low: number | undefined;
    let high: number | undefined;
    // Which source won decides how much the observed spread can be trusted below.
    let quoteSource: "hourly" | "latest" = "latest";

    if (priceData.hourVolume && priceData.hourLow != null && priceData.hourHigh != null) {
      low = priceData.hourLow;
      high = priceData.hourHigh;
      quoteSource = "hourly";
    } else {
      // A quote nobody has traded against in 24h is not a price you can transact at.
      const staleAfter = Date.now() - SCANNER_MAX_QUOTE_AGE_MS;
      if ((priceData.highTime ?? 0) >= staleAfter && (priceData.lowTime ?? 0) >= staleAfter) {
        low = priceData.low;
        high = priceData.high;
      }
    }

    if (low == null || high == null || low <= 0 || high < low) continue;

    // Anything wider than this is an artifact, not an opportunity — real GE margins on
    // tradeable items run low single digits. Without it the profit sort is topped by
    // items like "Fishbowl: buy 200, sell 1,000,000".
    if ((high - low) / low > SCANNER_MAX_SPREAD_RATIO) continue;

    const buyPrice = low;
    const sellPrice = high;
    const margin = high - low;
    const marginVolume = margin * volume;

    // ponytail: profit used to be margin * geLimit — what you'd make if you filled the
    // entire buy limit. Buy limits reset every 4h and the median item trades 421 units a
    // DAY, so for 57% of rows that quantity does not exist. Measured against the live
    // API: 6 of the top 12 by netProfit could not move a single unit in a 4h window
    // ("Sceptre of enchantment", 2 traded per day, ranked #2 at 2,290M). Cap the
    // quantity at what actually trades in one window — a sixth of the 24h figure.
    // Upgrade path: /timeseries gives real per-window volume if the sixth is too crude.
    const fillQty = Math.min(geLimit, Math.floor(volume / 6));

    // Calculate tax (2% of sell price, no cap)
    const taxPerItem = sellPrice <= 49 ? 0 : Math.floor(sellPrice * 0.02);
    const netPerUnit = margin - taxPerItem;

    const potentialProfit = margin * fillQty;
    const netProfit = netPerUnit * fillQty;

    // Per-unit, so ROI stays defined for the 7% of items with fillQty 0 — an item you
    // cannot move in bulk still has a real margin, and geLimit always cancelled here
    // anyway. It is a rate, not a total; netProfit is the total.
    const roi = buyPrice > 0 ? (netPerUnit / buyPrice) * 100 : 0;

    // Capital efficiency (profit per 1M GP invested, as basis points)
    const capitalEfficiency = buyPrice > 0 ? (netPerUnit / buyPrice) * 10000 : 0;
    
    // Real 24h price direction: mid now vs the mid of the same hourly block yesterday.
    // Previously this was derived from the fabricated margin, so it described spread
    // width — not direction — and collapsed to a single value for every item.
    const priorMid = hourlyMid(yesterday[String(item.id)]);
    const changePct = priorMid && priorMid > 0 ? ((price - priorMid) / priorMid) * 100 : null;
    const trend: "up" | "down" | "stable" =
      changePct == null ? "stable" : changePct > 1 ? "up" : changePct < -1 ? "down" : "stable";

    // Volatility based on margin relative to price
    const marginPercent = margin / price;
    const volatility: "low" | "medium" | "high" = marginPercent > 0.03 ? "high" : marginPercent > 0.01 ? "medium" : "low";
    
    // ponytail: this used to be calculateSmartPricing(price, null, null), which with no
    // indicators and no trade history returns TIER_MARGINS[tier].base unchanged — one
    // constant per price bracket, so all 2188 items showed 4 distinct values and every
    // confidence read "low". A per-item estimate presented as AI output that never looked
    // at the item. The observed spread is the real signal now, so blend toward it by how
    // much the quote can be trusted, and let confidence say which happened.
    const tierPricing = calculateSmartPricing(price, null, null);
    const tierBasePct = tierPricing.suggestedMarginPct / 100;
    const observedPct = margin / buyPrice;
    // Hourly averages need both sides traded within the hour, so they survive a single
    // mis-click; a lone /latest pair does not, and gets pulled harder toward the baseline.
    const observedWeight = quoteSource === "hourly" ? 0.8 : 0.5;
    const suggestedPct = Math.min(
      SCANNER_MAX_SPREAD_RATIO,
      observedPct * observedWeight + tierBasePct * (1 - observedWeight),
    );
    const confidence: "low" | "medium" | "high" =
      quoteSource === "hourly" ? "high" : observedPct > 0 ? "medium" : "low";
    const halfMargin = suggestedPct / 2;
    const smartPricing = {
      suggestedBuyPrice: Math.round(price * (1 - halfMargin)),
      suggestedSellPrice: Math.round(price * (1 + halfMargin)),
      suggestedMarginPct: Math.round(suggestedPct * 10000) / 100,
      priceTier: tierPricing.priceTier,
      confidence,
    };

    results.push({
      id: item.id,
      name: item.name,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
      isMembers: item.isMembers ?? false,
      category: itemCategories[String(item.id)] ?? UNCATEGORISED,
      geLimit,
      buyPrice,
      sellPrice,
      margin,
      volume,
      hourVolume: priceData.hourVolume ?? 0,
      fillQty,
      potentialProfit,
      marginVolume,
      roi: Math.round(roi * 100) / 100,
      netProfit,
      capitalEfficiency: Math.round(capitalEfficiency),
      trend,
      changePct24h: changePct == null ? null : Math.round(changePct * 100) / 100,
      volatility,
      suggestedBuyPrice: smartPricing.suggestedBuyPrice,
      suggestedSellPrice: smartPricing.suggestedSellPrice,
      suggestedMarginPct: smartPricing.suggestedMarginPct,
      priceTier: smartPricing.priceTier,
      confidence: smartPricing.confidence,
      range7dLow: null,
      range7dHigh: null,
      range7dSpreadPct: null,
    });
  }

  // range7d* stay null here on purpose. They used to be filled from a cache that only
  // ever populated under `npm run dev` (startRange7dCacheRefresh was called from
  // server/index.ts, but Vercel enters through server/vercel.ts), so in production every
  // value came from the sqrt(7) random-walk guess that used to live here — while the UI
  // labelled it a "data-backed spread". The real 7d/30d range is computed per item from
  // actual history in GET /api/scanner/item/:id/detail.
  return results;
}


export interface MarketMover {
  itemId: number;
  itemName: string;
  currentPrice: number;
  volume: number;
  members: boolean;
  price24hAgo: number | null;
  price7dAgo: number | null;
  change24h: number;
  change7d: number;
  changePercent24h: number;
  changePercent7d: number;
}

/**
 * Biggest 24h movers by traded volume.
 *
 * Replaces a route body that re-downloaded the full 2.3MB GE dump every 5 minutes and
 * then fired 100 concurrent unthrottled history requests — the exact access pattern the
 * wiki asks consumers not to use. This is three memoized bulk calls instead, shared with
 * the scanner. Items with no anchor price are excluded rather than reported as 0% movers,
 * which is what the old `price24h = item.currentPrice` default produced.
 */
export async function getMarketMovers(limit = 20): Promise<{
  gainers: MarketMover[];
  losers: MarketMover[];
  mostActive: MarketMover[];
}> {
  await refreshItemCache();
  const [thisHour, dayAgo, weekAgo] = await Promise.all([
    getHourly(),
    getHourly24hAgo(),
    getHourly7dAgo(),
  ]);

  const rows: MarketMover[] = [];

  for (const item of itemCache) {
    const priceData = itemPriceCache.get(item.id);
    if (!priceData || priceData.price < 100) continue;

    // Compare like with like: both ends of the change should be hourly averages where
    // possible. Using the /latest mid here made a single outlier trade on a 20gp dart
    // read as a +2450% "gain".
    const current = hourlyMid(thisHour[String(item.id)]) ?? priceData.price;
    if (current < 100) continue;
    const price24hAgo = hourlyMid(dayAgo[String(item.id)]);
    const price7dAgo = hourlyMid(weekAgo[String(item.id)]);
    if (price24hAgo == null && price7dAgo == null) continue;

    const change24h = price24hAgo != null ? current - price24hAgo : 0;
    const change7d = price7dAgo != null ? current - price7dAgo : 0;

    rows.push({
      itemId: item.id,
      itemName: item.name,
      currentPrice: current,
      volume: priceData.volume ?? 0,
      members: item.isMembers ?? false,
      price24hAgo,
      price7dAgo,
      change24h,
      change7d,
      changePercent24h: price24hAgo ? (change24h / price24hAgo) * 100 : 0,
      changePercent7d: price7dAgo ? (change7d / price7dAgo) * 100 : 0,
    });
  }

  const byVolume = [...rows].sort((a, b) => b.volume - a.volume).slice(0, 100);
  const moved = byVolume.filter((r) => r.price24hAgo != null);

  return {
    gainers: [...moved]
      .filter((r) => r.changePercent24h > 0)
      .sort((a, b) => b.changePercent24h - a.changePercent24h)
      .slice(0, limit),
    losers: [...moved]
      .filter((r) => r.changePercent24h < 0)
      .sort((a, b) => a.changePercent24h - b.changePercent24h)
      .slice(0, limit),
    mostActive: byVolume.slice(0, limit),
  };
}
