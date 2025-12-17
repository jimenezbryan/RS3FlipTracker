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
}

let itemCache: CachedItem[] = [];
let itemPriceCache: Map<number, { price: number; volume?: number }> = new Map();
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
      });
      
      if (itemData.price) {
        itemPriceCache.set(id, {
          price: itemData.price,
          volume: itemData.volume,
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
      });
    }
  }
  
  return results;
}

export async function getItemPrice(itemName: string): Promise<GEItem | null> {
  try {
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
    const itemId = itemData.id;

    return {
      id: parseInt(itemId),
      name: foundName,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
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

export async function getItemPriceHistory(itemId: number): Promise<PriceHistoryPoint[] | null> {
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

    return sortedHistory.map((h: any) => ({
      date: h.timestamp.split('T')[0],
      price: h.price,
      volume: h.volume,
    }));
  } catch (error) {
    console.error("Failed to fetch item price history:", error);
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
