import { calculateSmartPricing, getPriceTier, calculateObservableRange } from "./technical-indicators";

const GE_API_BASE = "https://api.weirdgloop.org/exchange/history/rs";
const RS_ITEMDB_BASE = "https://secure.runescape.com/m=itemdb_rs";
const GE_IDS_URL = "https://runescape.wiki/w/Module:GEIDs/data.json?action=raw";
const GE_DUMP_URL = "https://chisel.weirdgloop.org/gazproj/gazbot/rs_dump.json";

const USER_AGENT = "RS3FlipTracker/1.0 (Replit App; contact@replit.com)";

export interface GEItem {
  id: number;
  name: string;
  price: number;
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

let itemCache: CachedItem[] = [];
let itemPriceCache: Map<number, { price: number; last?: number; volume?: number; isMembers?: boolean; geLimit?: number; examine?: string }> = new Map();
let cacheLastUpdated = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function refreshItemCache(): Promise<void> {
  const now = Date.now();
  if (itemCache.length > 0 && now - cacheLastUpdated < CACHE_TTL) {
    return;
  }

  try {
    console.log("[ge-api] Refreshing item cache from GE dump...");
    
    const response = await fetch(GE_DUMP_URL, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      console.error("[ge-api] Failed to fetch GE dump:", response.status);
      return;
    }

    const data = await response.json();
    const items: CachedItem[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("%")) continue;
      
      const itemData = value as any;
      const id = parseInt(key);
      
      if (isNaN(id) || !itemData.name) continue;
      
      items.push({
        id,
        name: itemData.name,
        nameLower: itemData.name.toLowerCase(),
        isMembers: itemData.members,
        geLimit: itemData.limit,
        examine: itemData.examine,
      });
      
      if (itemData.price) {
        itemPriceCache.set(id, {
          price: itemData.price,
          last: itemData.last,
          volume: itemData.volume,
          isMembers: itemData.members,
          geLimit: itemData.limit,
          examine: itemData.examine,
        });
      }
    }
    
    itemCache = items;
    cacheLastUpdated = now;
    console.log(`[ge-api] Cached ${items.length} items`);
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
    
    const response = await fetch(
      `${GE_API_BASE}/latest?name=${encodeURIComponent(itemName)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const keys = Object.keys(data).filter(k => !k.startsWith("%"));
    
    if (keys.length === 0) return null;

    const foundName = keys[0];
    const itemData = data[foundName];
    const itemId = parseInt(itemData.id);
    
    const cachedData = itemPriceCache.get(itemId);

    return {
      id: itemId,
      name: foundName,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
      isMembers: cachedData?.isMembers,
      geLimit: cachedData?.geLimit,
      examine: cachedData?.examine,
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

export type ChartPeriod = "daily" | "weekly" | "monthly" | "yearly";

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
  potentialProfit: number;
  marginVolume: number;
  roi: number;
  netProfit: number;
  capitalEfficiency: number;
  rsi: number;
  trend: "up" | "down" | "stable";
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
  
  const results: ScannerItem[] = [];
  
  for (const item of itemCache) {
    const priceData = itemPriceCache.get(item.id);
    if (!priceData || priceData.price <= 0) continue;
    
    const price = priceData.price;
    const lastPrice = priceData.last ?? price;
    const geLimit = item.geLimit ?? 0;
    const volume = priceData.volume ?? 0;
    
    // Estimate margin as 1% of price (since we don't have instant buy/sell data)
    const margin = Math.round(price * 0.01);
    const buyPrice = price;
    const sellPrice = price + margin;
    const potentialProfit = margin * geLimit;
    const marginVolume = margin * volume;
    
    // Calculate tax (2% of sell price, no cap)
    const taxPerItem = sellPrice <= 49 ? 0 : Math.floor(sellPrice * 0.02);
    const totalTax = taxPerItem * geLimit;
    
    // Net profit after tax for one limit cycle
    const grossProfit = margin * geLimit;
    const netProfit = grossProfit - totalTax;
    
    // ROI after tax (percentage)
    const totalInvestment = buyPrice * geLimit;
    const roi = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100) : 0;
    
    // Capital efficiency (profit per 1M GP invested, as basis points)
    const capitalEfficiency = totalInvestment > 0 ? (netProfit / totalInvestment) * 10000 : 0;
    
    // Simulated RSI based on volume and price (for visual purposes)
    // Higher volume + higher margin tends toward overbought, low volume + low margin toward oversold
    const volumeScore = volume > 0 ? Math.min(volume / 10000, 1) : 0;
    const marginScore = margin > 0 ? Math.min(margin / price, 0.1) * 10 : 0;
    const rsi = Math.round(30 + (volumeScore * 30) + (marginScore * 40)); // Range roughly 30-100
    
    // Trend based on margin direction (simulated since we don't have historical data here)
    // Use price thresholds as proxy
    const trend: "up" | "down" | "stable" = margin > price * 0.015 ? "up" : margin < price * 0.005 ? "down" : "stable";
    
    // Volatility based on margin relative to price
    const marginPercent = margin / price;
    const volatility: "low" | "medium" | "high" = marginPercent > 0.03 ? "high" : marginPercent > 0.01 ? "medium" : "low";
    
    const smartPricing = calculateSmartPricing(price, null, null);

    results.push({
      id: item.id,
      name: item.name,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
      isMembers: item.isMembers ?? false,
      geLimit,
      buyPrice,
      sellPrice,
      margin,
      volume,
      potentialProfit,
      marginVolume,
      roi: Math.round(roi * 100) / 100,
      netProfit,
      capitalEfficiency: Math.round(capitalEfficiency),
      rsi: Math.min(100, Math.max(0, rsi)),
      trend,
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

  for (const r of results) {
    const cached = range7dCache.get(r.id);
    if (cached) {
      r.range7dLow = cached.low;
      r.range7dHigh = cached.high;
      r.range7dSpreadPct = cached.spreadPct;
    } else {
      const pd = itemPriceCache.get(r.id);
      if (pd && pd.price > 0) {
        const current = pd.price;
        const last = pd.last ?? current;
        const dailyDelta = Math.abs(current - last);
        const swing7d = dailyDelta * Math.sqrt(7);
        const minSwing = Math.max(1, Math.round(current * 0.001));
        const effectiveSwing = Math.max(swing7d, minSwing);
        r.range7dLow = Math.round(Math.min(current, last) - effectiveSwing);
        r.range7dHigh = Math.round(Math.max(current, last) + effectiveSwing);
        if (r.range7dLow <= 0) r.range7dLow = 1;
        r.range7dSpreadPct = r.range7dLow > 0
          ? Math.round(((r.range7dHigh - r.range7dLow) / r.range7dLow) * 10000) / 100
          : 0;
      }
    }
  }

  return results;
}

const range7dCache = new Map<number, { low: number; high: number; spreadPct: number }>();
let range7dCacheReady = false;
const RANGE_REFRESH_INTERVAL = 15 * 60 * 1000;

async function refreshRange7dCache(): Promise<void> {
  await refreshItemCache();
  const itemsByVolume = Array.from(itemPriceCache.entries())
    .filter(([, d]) => d.price > 0 && (d.volume ?? 0) > 0)
    .sort(([, a], [, b]) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 100)
    .map(([id]) => id);

  const batchSize = 5;
  for (let i = 0; i < itemsByVolume.length; i += batchSize) {
    const batch = itemsByVolume.slice(i, i + batchSize);
    await Promise.all(batch.map(async (id) => {
      try {
        const full = await getItemPriceHistoryFull(id);
        if (full && full.daily.length >= 2) {
          const range = calculateObservableRange(full.daily, 7);
          if (range) {
            range7dCache.set(id, { low: range.low, high: range.high, spreadPct: range.spreadPct });
          }
        }
      } catch (err) {
        console.error(`[range7d] Failed to fetch history for item ${id}:`, err);
      }
    }));
  }

  range7dCacheReady = true;
  console.log(`[range7d] Cache refreshed with ${range7dCache.size} items`);
}

export function startRange7dCacheRefresh(): void {
  refreshRange7dCache();
  setInterval(() => refreshRange7dCache(), RANGE_REFRESH_INTERVAL);
}

export async function getItemById(itemId: number): Promise<GEItem | null> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/latest?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const itemData = data[itemId.toString()];
    
    if (!itemData) return null;

    return {
      id: itemId,
      name: itemData.name || `Item ${itemId}`,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
    };
  } catch (error) {
    console.error("Failed to fetch item by ID:", error);
    return null;
  }
}
