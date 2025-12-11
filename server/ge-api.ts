const GE_API_BASE = "https://api.weirdgloop.org/exchange/history/rs";
const RS_ITEMDB_BASE = "https://secure.runescape.com/m=itemdb_rs";

const USER_AGENT = "RS3FlipTracker/1.0 (Replit App)";

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
    const keys = Object.keys(data);
    
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

export async function searchItems(query: string): Promise<GEItem[]> {
  try {
    const response = await fetch(
      `${GE_API_BASE}/latest?name=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const items: GEItem[] = [];

    for (const [itemName, itemData] of Object.entries(data)) {
      const item = itemData as any;
      items.push({
        id: parseInt(item.id),
        name: itemName,
        price: item.price,
        volume: item.volume,
        timestamp: item.timestamp,
        icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
      });
    }

    return items;
  } catch (error) {
    console.error("Failed to search items:", error);
    return [];
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
