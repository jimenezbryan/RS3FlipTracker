/**
 * The Scanner's full pipeline — scoring, toggles, band/column filters, sort — as pure functions.
 *
 * Moved out of client/src/pages/Scanner.tsx so the SAME code runs in the browser and in the
 * alert runner (server/scannerAlerts.ts). A saved preset evaluated on the server must produce
 * exactly the rows the Scanner would show for it; two copies of this logic would drift the
 * first time a threshold is recalibrated. Three project logs recorded this block as "trapped in
 * a useMemo and unguarded" — this is the fifth module to go to shared/ for that reason.
 *
 * No React, no server deps, so scripts/check-scanner-alerts.ts can exercise it offline.
 */
import { z } from "zod";
import { matchesSelection, type FilterSelection } from "./scannerFilters";
import { matchesColumnFilters, type ColumnFilters, type FilterableRow } from "./columnFilters";

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

export interface ScoredItem extends ScannerItem {
  volumeRatio: number;
  volumeScore: number;
  momentumScore: number;
  valueScore: number;
  riskScore: number;
  riskRewardRatio: number;
  tradeScore: number;
  signals: string[];
}

export type SortKey =
  | keyof ScannerItem
  | "tradeScore"
  | "volumeScore"
  | "momentumScore"
  | "valueScore"
  | "riskScore"
  | "suggestedMarginPct";
export type SortDirection = "asc" | "desc";

export const SIGNAL_PRIORITY: Record<string, number> = {
  "Smart Money": 1,
  "Deep Value": 1,
  "Accumulation": 2,
  "Strong Trend": 2,
  "Good Value": 3,
  "Distribution": 3,
  "Pullback": 2,
};

// ponytail: every one of these used to be compared against a margin the server hardcoded to
// 1% of price, so the margin-gated conditions effectively never fired and the ones that did
// fired on volume alone. With real spreads (median ~7%) the same thresholds fired on 93% of
// items, which is why "signals only" filtered almost nothing. Recalibrated against the live
// distribution: each marks roughly the top quartile-to-decile of its own axis.
// Tighten these to make the scanner pickier — they are the only dial that matters here.
const SIGNAL_DEEP_VALUE_ROI = 30;   // post-tax ROI %, ~p90
const SIGNAL_GOOD_VALUE_ROI = 15;   // post-tax ROI %, ~p75
const SIGNAL_MIN_MOVE_PCT = 10;     // |24h move| %, ~p75

export const HIGH_SCORE_MIN = 60;

export function scoreItems(items: ScannerItem[]): ScoredItem[] {
  if (items.length === 0) return [];

  // ponytail: volume was scored as a ratio to the global MEAN. Volume is power-law —
  // measured live, mean 309,660 against a median of 421, a 735x gap — so
  // min(100, ratio * 50) floored 1350 of 2158 items at exactly 0. The median item
  // scored zero, which made 25% of tradeScore a constant for two thirds of the list.
  // Percentile rank is scale-free and needs one sort.
  const globalAvgVolume = items.reduce((sum, item) => sum + item.volume, 0) / items.length;

  const volumeRankById = new Map<number, number>();
  [...items]
    .sort((a, b) => a.volume - b.volume)
    .forEach((item, i) => {
      volumeRankById.set(item.id, items.length > 1 ? (i / (items.length - 1)) * 100 : 50);
    });

  return items.map((item) => {
    const marginPercent = item.buyPrice > 0 ? (item.margin / item.buyPrice) * 100 : 0;

    // 1. VOLUME ANALYSIS (Institutional Detection)
    // Percentile of 24h volume across the scanned set: 100 = most traded item on screen.
    const volumeScore = Math.round(volumeRankById.get(item.id) ?? 0);
    // Kept for the detail panel, which shows "Nx average volume". The signals below no
    // longer gate on it — against a mean this skewed, "2x average" meant top 4%.
    const volumeRatio = globalAvgVolume > 0 ? item.volume / globalAvgVolume : 0;

    // 2. MOMENTUM INDICATORS
    // Driven by the real 24h price direction. The RSI that used to weight this was
    // synthesised server-side from volume, so it carried no information the volume
    // score above didn't already have. Real RSI lives in the detail drawer.
    const momentumScore = item.trend === "up" ? 90 : item.trend === "stable" ? 55 : 20;

    // 3. VALUE METRICS
    let valueScore = 0;
    if (marginPercent > 5 || item.roi > 8) {
      valueScore = 100; // Deep Value
    } else if (marginPercent > 2 || item.roi > 4) {
      valueScore = 75; // Good Value
    } else if (marginPercent > 0) {
      valueScore = 50; // Fair Value
    } else {
      valueScore = Math.max(0, 30 + marginPercent * 5); // Negative margin
    }

    // 4. RISK/REWARD ANALYSIS
    // ponytail: reward and risk have to be the same unit. This compared potentialProfit —
    // margin across the whole buy limit — against a stop loss on a SINGLE unit, so the
    // ratio was inflated by roughly geLimit and "Favorable R/R" fired on 93% of items.
    // Per-unit margin against per-unit stop loss is the comparison that was intended.
    const stopLossAmount = item.buyPrice * 0.02; // 2% stop loss assumption, per unit
    const riskRewardRatio = stopLossAmount > 0 ? item.margin / stopLossAmount : 0;
    // R/R scoring: ratio > 3 = 100, ratio > 2 = 75, ratio > 1 = 50
    const riskScore = Math.min(100, Math.max(0, Math.round(riskRewardRatio * 25)));

    // 5. COMPOSITE TRADE SCORE (weighted average)
    const tradeScore = Math.round(
      volumeScore * 0.25 +      // 25% weight on volume
      momentumScore * 0.25 +    // 25% weight on momentum
      valueScore * 0.30 +       // 30% weight on value (most important)
      riskScore * 0.20          // 20% weight on risk/reward
    );

    // 6. SIGNAL GENERATION with priority system
    const signals: string[] = [];

    // Volume signals (Priority 1-2)
    // Gated on percentile, not on a ratio to the mean. The old ">2x average" gate was
    // top 4% of items and ">1.5x" barely wider, because the mean sits at the 99th
    // percentile of a power-law. Top decile / top quartile is what those meant to say.
    if (volumeScore >= 90) {
      signals.push("Smart Money"); // Priority 1 - institutions moving
    }
    if (volumeScore >= 75 && marginPercent > 0 && (item.trend === "stable" || item.trend === "down")) {
      signals.push("Accumulation"); // Priority 2 - quiet buying
    }
    if (volumeScore >= 75 && marginPercent < 0) {
      signals.push("Distribution"); // Priority 3 - selling pressure
    }

    // Momentum signals (Priority 2)
    // "Oversold"/"Overbought" used to come from the synthesised RSI, so they fired on
    // volume alone and meant nothing. Real overbought/oversold is in the detail drawer.
    // These gate on the SIZE of the 24h move, not just its direction — "trend is down and
    // the spread is over 2%" was true of nearly every falling item once spreads were real.
    const move = Math.abs(item.changePct24h ?? 0);
    if (item.trend === "down" && move > SIGNAL_MIN_MOVE_PCT) {
      signals.push("Pullback"); // Priority 2 - meaningful drop, not noise
    }
    if (item.trend === "up" && move > SIGNAL_MIN_MOVE_PCT) {
      signals.push("Strong Trend"); // Priority 2
    }

    // Value signals (Priority 1, 3)
    // Post-tax ROI only. The old margin-percent arm double-counted the same quantity and
    // was set for a 1% world, so it fired on ~60% of items.
    if (item.roi > SIGNAL_DEEP_VALUE_ROI) {
      signals.push("Deep Value"); // Priority 1 - exceptional
    } else if (item.roi > SIGNAL_GOOD_VALUE_ROI) {
      signals.push("Good Value"); // Priority 3
    }

    // ponytail: "Favorable R/R" and "High Reward" deleted. Once the unit bug above is
    // fixed the ratio is just margin% / 2, so both restated the value signals and fired
    // on every item that already had one — measured: identical item set with and without
    // them, they only crowded the top-3 display.

    // Sort signals by priority and take top 3
    const sortedSignals = signals
      .sort((a, b) => (SIGNAL_PRIORITY[a] || 99) - (SIGNAL_PRIORITY[b] || 99))
      .slice(0, 3);

    return {
      ...item,
      volumeRatio,
      volumeScore,
      momentumScore,
      valueScore,
      riskScore,
      riskRewardRatio,
      tradeScore,
      signals: sortedSignals,
    };
  });
}

/** Alert cadence menu, in minutes. 15 is the floor because the GitHub cron ticks every 15. */
export const SCANNER_ALERT_INTERVALS = [15, 30, 60, 120, 240, 720, 1440] as const;
/** Lines per Discord embed. 25 × ~80 chars stays well under the 4096-char description cap. */
export const SCANNER_ALERT_MAX_TOP_N = 25;

/** Everything the Scanner's filter state holds. Plain JSON, so it is what a preset stores. */
export interface PresetFilters {
  searchQuery: string;
  f2pOnly: boolean;
  watchlistOnly: boolean;
  signalsOnly: boolean;
  showUnprofitable: boolean;
  highScoreOnly: boolean;
  selection: FilterSelection;
  columnFilters: ColumnFilters;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

const columnFilterSchema = z.union([
  z.object({ kind: z.literal("range"), min: z.number().nullable(), max: z.number().nullable() }),
  z.object({ kind: z.literal("set"), values: z.array(z.string()) }),
  z.object({ kind: z.literal("text"), query: z.string() }),
]);

export const presetFiltersSchema = z.object({
  searchQuery: z.string().default(""),
  f2pOnly: z.boolean().default(false),
  watchlistOnly: z.boolean().default(false),
  signalsOnly: z.boolean().default(false),
  showUnprofitable: z.boolean().default(false),
  highScoreOnly: z.boolean().default(false),
  selection: z.object({
    buyLimitBandId: z.string().nullable(),
    priceBandId: z.string().nullable(),
    categories: z.array(z.string()),
  }),
  columnFilters: z.record(columnFilterSchema),
  // ponytail: a free string, not an enum of every key. An unknown key sorts as "absent" in
  // compare() below, which is harmless, and keeping this in sync with ScannerItem by hand is
  // exactly the kind of drift this module exists to remove.
  sortKey: z.string(),
  sortDirection: z.enum(["asc", "desc"]),
}) as z.ZodType<PresetFilters>;

/** ScoredItem is a fixed interface; FilterableRow is an index signature. The fields the
 *  filters read are all CellValue-shaped, so the cast is safe and saves restating them. */
export const asRow = (item: ScoredItem) => item as unknown as FilterableRow;

/**
 * The toggles and search box. Split from applyFiltersAndSort deliberately: facet counts in the
 * filter panel are only truthful when computed over what is otherwise reachable, so the Scanner
 * needs this intermediate set on its own.
 */
export function applyToggles(
  items: ScoredItem[],
  f: PresetFilters,
  favoriteItemIds: Set<number>,
): ScoredItem[] {
  let result = items;

  if (f.searchQuery.trim()) {
    const query = f.searchQuery.toLowerCase();
    result = result.filter((item) => item.name.toLowerCase().includes(query));
  }
  if (f.f2pOnly) result = result.filter((item) => !item.isMembers);
  if (f.watchlistOnly) result = result.filter((item) => favoriteItemIds.has(item.id));
  if (!f.showUnprofitable) result = result.filter((item) => item.netProfit > 0);
  if (f.signalsOnly) result = result.filter((item) => item.signals.length > 0);
  if (f.highScoreOnly) result = result.filter((item) => item.tradeScore >= HIGH_SCORE_MIN);

  return result;
}

const compare = (a: ScoredItem, b: ScoredItem, key: SortKey) => {
  const aVal = a[key];
  const bVal = b[key];

  if (typeof aVal === "string" && typeof bVal === "string") {
    return aVal.localeCompare(bVal);
  }
  if (typeof aVal === "boolean" && typeof bVal === "boolean") {
    return (aVal ? 1 : 0) - (bVal ? 1 : 0);
  }
  // null sorts as absent, not as zero — a missing 24h change is not "no change".
  const numA = aVal == null ? Number.NEGATIVE_INFINITY : Number(aVal) || 0;
  const numB = bVal == null ? Number.NEGATIVE_INFINITY : Number(bVal) || 0;
  return numA - numB;
};

export function applyFiltersAndSort(items: ScoredItem[], f: PresetFilters): ScoredItem[] {
  // Band/category selection and the per-column filters compose by intersection: a band is a
  // coarse preset, a column range is precise, and both narrowing at once is the expected
  // reading of two active filters.
  const result = items.filter(
    (item) => matchesSelection(item, f.selection) && matchesColumnFilters(asRow(item), f.columnFilters),
  );

  // ponytail: several sortable columns are buckets, not continuous values — trend and
  // volatility have 3 each, priceTier and confidence 4, and suggestedMarginPct resolves to
  // one constant per price tier while calculateSmartPricing gets no real indicators. Ties
  // kept whatever order they already had, so clicking those headers looked like it did
  // nothing. Falling back to netProfit gives every tie a meaningful, stable order.
  result.sort((a, b) => {
    const primary = compare(a, b, f.sortKey);
    if (primary !== 0) return f.sortDirection === "asc" ? primary : -primary;
    return f.sortKey === "netProfit" ? 0 : b.netProfit - a.netProfit;
  });

  return result;
}

/** What the Scanner would show for this preset, in this order. The one entry point the alert
 *  runner uses — same functions as the page, not a reimplementation. */
export function runPreset(
  items: ScannerItem[],
  f: PresetFilters,
  favoriteItemIds: Set<number> = new Set(),
): ScoredItem[] {
  return applyFiltersAndSort(applyToggles(scoreItems(items), f, favoriteItemIds), f);
}

// ── Alert rules. Pure, so scripts/check-scanner-alerts.ts can pin them offline. ──────────

/** Mirror of the SQL in storage.getDueAlertPresets. */
export function isDue(
  preset: { alertEnabled: boolean; lastRunAt: Date | null; intervalMinutes: number },
  now: Date,
): boolean {
  if (!preset.alertEnabled) return false;
  if (!preset.lastRunAt) return true;
  // One minute of slack: the cron tick lands a little early or late, and a 60-minute alert
  // ticked at 59m58s should run now, not an hour from now.
  const dueAt = preset.lastRunAt.getTime() + (preset.intervalMinutes - 1) * 60_000;
  return now.getTime() >= dueAt;
}

/** What one run sends, or null for silence. */
export function pickItems(
  preset: { mode: string; topN: number; lastItemIds: number[] | null },
  results: ScoredItem[],
  opts: { force?: boolean } = {},
): { items: ScoredItem[]; total: number } | null {
  if (preset.mode === "new") {
    // First run has nothing to diff against: record the baseline and say nothing, unless the
    // user pressed "Send test" and wants to see output regardless.
    if (preset.lastItemIds == null && !opts.force) return null;
    const seen = new Set(preset.lastItemIds ?? []);
    const fresh = results.filter((i) => !seen.has(i.id));
    if (fresh.length === 0) return null;
    return { items: fresh.slice(0, preset.topN), total: fresh.length };
  }
  if (results.length === 0) return null;
  return { items: results.slice(0, preset.topN), total: results.length };
}
