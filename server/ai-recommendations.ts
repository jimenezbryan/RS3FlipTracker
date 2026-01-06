import OpenAI from "openai";
import type { Flip } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface UserTradingProfile {
  preferredStrategies: { strategy: string; frequency: number; avgROI: number; winRate: number }[];
  preferredPriceRange: { min: number; max: number };
  avgHoldTime: number;
  riskProfile: "conservative" | "moderate" | "aggressive";
  membershipPreference: "members" | "f2p" | "both";
  totalFlips: number;
  winRate: number;
  avgROI: number;
  topPerformingItems: { name: string; profit: number; roiPercent: number }[];
  frequentlyTradedItems: string[];
  tradingVolume: { daily: number; weekly: number; monthly: number };
}

export interface PersonalizedRecommendation {
  itemName: string;
  itemId: number;
  itemIcon?: string;
  currentPrice: number;
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  potentialProfit: number;
  potentialROI: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  matchScore: number;
  matchReasons: string[];
  strategy: string;
  riskLevel: "low" | "medium" | "high";
  estimatedHoldTime: string;
}

export function analyzeUserTradingProfile(flips: Flip[]): UserTradingProfile {
  const completedFlips = flips.filter(f => f.sellPrice && f.sellDate && !f.deletedAt);
  
  const strategyStats = new Map<string, { count: number; totalROI: number; wins: number }>();
  const itemCounts = new Map<string, number>();
  const itemProfits = new Map<string, { profit: number; totalRoi: number; count: number }>();
  
  let totalProfit = 0;
  let totalROI = 0;
  let wins = 0;
  let totalHoldTime = 0;
  let minPrice = Infinity;
  let maxPrice = 0;
  let membersCount = 0;
  let f2pCount = 0;
  
  const now = Date.now();
  let dailyVolume = 0;
  let weeklyVolume = 0;
  let monthlyVolume = 0;
  
  for (const flip of completedFlips) {
    const sellPrice = flip.sellPrice as number;
    const sellValue = sellPrice * flip.quantity;
    const buyValue = flip.buyPrice * flip.quantity;
    const taxPaid = Math.floor(sellPrice * 0.02) * flip.quantity; // 2% per item, floored
    const profit = sellValue - buyValue - taxPaid;
    const roi = ((sellValue - buyValue - taxPaid) / buyValue) * 100;
    
    totalProfit += profit;
    totalROI += roi;
    if (profit > 0) wins++;
    
    const holdTime = new Date(flip.sellDate as Date).getTime() - new Date(flip.buyDate).getTime();
    totalHoldTime += holdTime;
    
    minPrice = Math.min(minPrice, flip.buyPrice);
    maxPrice = Math.max(maxPrice, flip.buyPrice, sellPrice);
    
    if (flip.isMembers) membersCount++;
    else f2pCount++;
    
    const strategy = flip.strategyTag || "Other";
    const stats = strategyStats.get(strategy) || { count: 0, totalROI: 0, wins: 0 };
    stats.count++;
    stats.totalROI += roi;
    if (profit > 0) stats.wins++;
    strategyStats.set(strategy, stats);
    
    const itemName = flip.itemName;
    itemCounts.set(itemName, (itemCounts.get(itemName) || 0) + 1);
    
    const existing = itemProfits.get(itemName) || { profit: 0, totalRoi: 0, count: 0 };
    existing.profit += profit;
    existing.totalRoi += roi;
    existing.count += 1;
    itemProfits.set(itemName, existing);
    
    const buyDate = new Date(flip.buyDate).getTime();
    if (now - buyDate < 86400000) dailyVolume += buyValue;
    if (now - buyDate < 604800000) weeklyVolume += buyValue;
    if (now - buyDate < 2592000000) monthlyVolume += buyValue;
  }
  
  const preferredStrategies = Array.from(strategyStats.entries())
    .map(([strategy, stats]) => ({
      strategy,
      frequency: stats.count,
      avgROI: stats.count > 0 ? stats.totalROI / stats.count : 0,
      winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    }))
    .sort((a, b) => b.frequency - a.frequency);
  
  const avgROI = completedFlips.length > 0 ? totalROI / completedFlips.length : 0;
  const winRate = completedFlips.length > 0 ? (wins / completedFlips.length) * 100 : 0;
  const avgHoldTime = completedFlips.length > 0 ? totalHoldTime / completedFlips.length : 0;
  
  let riskProfile: "conservative" | "moderate" | "aggressive" = "moderate";
  const avgFlipValue = completedFlips.length > 0 
    ? completedFlips.reduce((sum, f) => sum + f.buyPrice * f.quantity, 0) / completedFlips.length 
    : 0;
  
  const hasFastFlips = preferredStrategies.some(s => s.strategy === "Fast Flip" && s.frequency > 2);
  const hasSpeculative = preferredStrategies.some(s => s.strategy === "Speculative" && s.frequency > 1);
  
  if (hasSpeculative || avgROI > 15) {
    riskProfile = "aggressive";
  } else if (hasFastFlips || avgROI < 5) {
    riskProfile = "conservative";
  }
  
  let membershipPreference: "members" | "f2p" | "both" = "both";
  if (membersCount > f2pCount * 2) membershipPreference = "members";
  else if (f2pCount > membersCount * 2) membershipPreference = "f2p";
  
  const topPerformingItems = Array.from(itemProfits.entries())
    .map(([name, data]) => ({ name, profit: data.profit, roiPercent: data.count > 0 ? data.totalRoi / data.count : 0 }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
  
  const frequentlyTradedItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);
  
  return {
    preferredStrategies,
    preferredPriceRange: { 
      min: minPrice === Infinity ? 0 : minPrice, 
      max: maxPrice === 0 ? 10000000 : maxPrice 
    },
    avgHoldTime,
    riskProfile,
    membershipPreference,
    totalFlips: completedFlips.length,
    winRate,
    avgROI,
    topPerformingItems,
    frequentlyTradedItems,
    tradingVolume: { daily: dailyVolume, weekly: weeklyVolume, monthly: monthlyVolume },
  };
}

// Interface for item stats calculated from user's trading history
interface ItemTradingStats {
  itemName: string;
  itemId: number | null;
  itemIcon: string | null;
  tradeCount: number;
  totalProfit: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  avgROI: number;
  winRate: number;
  avgHoldTimeMs: number;
  lastTraded: Date;
  strategies: string[];
  isMembers: boolean | null;
}

// Calculate detailed stats for each item from user's trading history
function calculateItemStats(flips: Flip[]): ItemTradingStats[] {
  const completedFlips = flips.filter(f => f.sellPrice && f.sellDate && !f.deletedAt);
  const itemMap = new Map<string, {
    trades: Flip[];
    totalProfit: number;
    totalBuyPrice: number;
    totalSellPrice: number;
    totalROI: number;
    wins: number;
    totalHoldTime: number;
    strategies: Set<string>;
  }>();
  
  for (const flip of completedFlips) {
    const sellPrice = flip.sellPrice as number;
    const taxPaid = Math.floor(sellPrice * 0.02) * flip.quantity;
    const profit = (sellPrice * flip.quantity) - (flip.buyPrice * flip.quantity) - taxPaid;
    const roi = ((sellPrice - flip.buyPrice - Math.floor(sellPrice * 0.02)) / flip.buyPrice) * 100;
    const holdTime = new Date(flip.sellDate as Date).getTime() - new Date(flip.buyDate).getTime();
    
    const existing = itemMap.get(flip.itemName) || {
      trades: [],
      totalProfit: 0,
      totalBuyPrice: 0,
      totalSellPrice: 0,
      totalROI: 0,
      wins: 0,
      totalHoldTime: 0,
      strategies: new Set<string>(),
    };
    
    existing.trades.push(flip);
    existing.totalProfit += profit;
    existing.totalBuyPrice += flip.buyPrice;
    existing.totalSellPrice += sellPrice;
    existing.totalROI += roi;
    if (profit > 0) existing.wins++;
    existing.totalHoldTime += holdTime;
    if (flip.strategyTag) existing.strategies.add(flip.strategyTag);
    
    itemMap.set(flip.itemName, existing);
  }
  
  return Array.from(itemMap.entries()).map(([itemName, data]) => {
    const count = data.trades.length;
    const latestFlip = data.trades.sort((a, b) => 
      new Date(b.sellDate as Date).getTime() - new Date(a.sellDate as Date).getTime()
    )[0];
    
    return {
      itemName,
      itemId: latestFlip?.itemId || null,
      itemIcon: latestFlip?.itemIcon || null,
      tradeCount: count,
      totalProfit: data.totalProfit,
      avgBuyPrice: Math.round(data.totalBuyPrice / count),
      avgSellPrice: Math.round(data.totalSellPrice / count),
      avgROI: data.totalROI / count,
      winRate: (data.wins / count) * 100,
      avgHoldTimeMs: data.totalHoldTime / count,
      lastTraded: new Date(latestFlip?.sellDate as Date),
      strategies: Array.from(data.strategies),
      isMembers: latestFlip?.isMembers ?? null,
    };
  });
}

export async function getPersonalizedRecommendations(
  profile: UserTradingProfile,
  existingFlips: Flip[]
): Promise<PersonalizedRecommendation[]> {
  const openPositions = existingFlips
    .filter(f => !f.sellPrice && !f.deletedAt)
    .map(f => f.itemName.toLowerCase());
  
  // Calculate stats for all items the user has traded
  const itemStats = calculateItemStats(existingFlips);
  
  // Filter out items with open positions
  const availableItems = itemStats.filter(
    item => !openPositions.includes(item.itemName.toLowerCase())
  );
  
  console.log("[AI Recommendations] Found", availableItems.length, "unique items in trading history");
  
  if (availableItems.length === 0) {
    console.log("[AI Recommendations] No items in history, returning empty");
    return [];
  }
  
  // If we have very few items, just return them directly sorted by performance
  if (availableItems.length <= 5) {
    console.log("[AI Recommendations] Few items, returning sorted by profit");
    return availableItems
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .map(item => buildRecommendation(item, profile, "Top performer from your history"));
  }
  
  // Build item summary for AI to analyze
  const itemSummaries = availableItems
    .sort((a, b) => b.tradeCount - a.tradeCount) // Prioritize frequently traded items
    .slice(0, 30) // Limit to top 30 items to keep prompt size reasonable
    .map(item => ({
      name: item.itemName,
      trades: item.tradeCount,
      profit: formatGp(item.totalProfit),
      avgBuy: formatGp(item.avgBuyPrice),
      avgSell: formatGp(item.avgSellPrice),
      roi: `${item.avgROI.toFixed(1)}%`,
      winRate: `${item.winRate.toFixed(0)}%`,
      holdTime: formatHoldTime(item.avgHoldTimeMs),
      strategies: item.strategies.join(", ") || "Unknown",
      members: item.isMembers ? "Members" : "F2P",
    }));
  
  const prompt = `You are an RS3 trading advisor. Analyze this user's trading history and select the 5 BEST items they should trade again.

USER PROFILE:
- Risk Profile: ${profile.riskProfile}
- Average ROI: ${profile.avgROI.toFixed(1)}%
- Win Rate: ${profile.winRate.toFixed(1)}%
- Preferred Strategies: ${profile.preferredStrategies.map(s => s.strategy).slice(0, 3).join(", ") || "Various"}

ITEMS FROM USER'S TRADING HISTORY (select from these ONLY):
${JSON.stringify(itemSummaries, null, 2)}

SELECTION CRITERIA:
1. Prioritize items with high profit AND high win rate
2. Consider items matching their preferred strategies
3. Factor in ROI and trading frequency
4. Balance between proven winners and items with improvement potential

Respond with JSON containing an "items" array. Each item must use the EXACT item name from the list above:
{
  "items": [
    {
      "itemName": "EXACT name from list",
      "reasoning": "Why this item suits them",
      "suggestedStrategy": "Fast Flip|Slow Flip|Bulk|High Margin|Speculative",
      "confidence": "high|medium|low",
      "matchScore": 0-100,
      "tips": "Specific trading tip for this item"
    }
  ]
}`;

  try {
    console.log("[AI Recommendations] Asking AI to analyze", itemSummaries.length, "items");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an RS3 GE trading advisor. Only select items from the provided list. Never suggest items not in the user's history." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    console.log("[AI Recommendations] AI response received");
    
    if (!content) {
      console.log("[AI Recommendations] No content, using profit-sorted fallback");
      return getTopProfitItems(availableItems, profile);
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.items || parsed.recommendations || parsed.suggestions || [];
    
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.log("[AI Recommendations] No valid AI suggestions, using profit-sorted fallback");
      return getTopProfitItems(availableItems, profile);
    }

    const recommendations: PersonalizedRecommendation[] = [];
    
    for (const suggestion of suggestions.slice(0, 5)) {
      if (!suggestion?.itemName) continue;
      
      // Find the item in our stats (case-insensitive match)
      const itemData = availableItems.find(
        i => i.itemName.toLowerCase() === suggestion.itemName.toLowerCase()
      );
      
      if (!itemData) {
        console.log("[AI Recommendations] AI suggested unknown item:", suggestion.itemName);
        continue;
      }
      
      recommendations.push(buildRecommendation(itemData, profile, suggestion.reasoning || "Matches your trading style", {
        confidence: suggestion.confidence,
        matchScore: suggestion.matchScore,
        strategy: suggestion.suggestedStrategy,
        tips: suggestion.tips,
      }));
    }
    
    // Fill remaining slots with top profit items if needed
    if (recommendations.length < 5) {
      const existingNames = new Set(recommendations.map(r => r.itemName.toLowerCase()));
      const remaining = availableItems
        .filter(i => !existingNames.has(i.itemName.toLowerCase()))
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5 - recommendations.length);
      
      for (const item of remaining) {
        recommendations.push(buildRecommendation(item, profile, "Top profit performer from your history"));
      }
    }
    
    console.log("[AI Recommendations] Returning", recommendations.length, "recommendations from history");
    return recommendations;
  } catch (error) {
    console.error("[AI Recommendations] Error:", error);
    return getTopProfitItems(availableItems, profile);
  }
}

// Build a recommendation from item stats
function buildRecommendation(
  item: ItemTradingStats,
  profile: UserTradingProfile,
  reasoning: string,
  aiData?: { confidence?: string; matchScore?: number; strategy?: string; tips?: string }
): PersonalizedRecommendation {
  const potentialProfit = item.avgSellPrice - item.avgBuyPrice - Math.floor(item.avgSellPrice * 0.02);
  const potentialROI = item.avgBuyPrice > 0 ? (potentialProfit / item.avgBuyPrice) * 100 : 0;
  
  let confidence: "high" | "medium" | "low" = "medium";
  if (aiData?.confidence === "high" || item.winRate >= 80) confidence = "high";
  else if (aiData?.confidence === "low" || item.winRate < 50) confidence = "low";
  
  const holdHours = item.avgHoldTimeMs / 3600000;
  let estimatedHoldTime = "1-3 days";
  if (holdHours < 4) estimatedHoldTime = "1-4 hours";
  else if (holdHours < 24) estimatedHoldTime = "4-24 hours";
  else if (holdHours < 72) estimatedHoldTime = "1-3 days";
  else estimatedHoldTime = "3+ days";
  
  let riskLevel: "low" | "medium" | "high" = "medium";
  if (item.winRate >= 75 && item.avgROI > 0) riskLevel = "low";
  else if (item.winRate < 50 || item.avgROI < 0) riskLevel = "high";
  
  const matchReasons: string[] = [];
  if (item.winRate >= 70) matchReasons.push(`${item.winRate.toFixed(0)}% win rate`);
  if (item.avgROI > profile.avgROI) matchReasons.push("Above your average ROI");
  if (item.tradeCount >= 5) matchReasons.push(`${item.tradeCount} successful trades`);
  if (item.totalProfit > 0) matchReasons.push(`${formatGp(item.totalProfit)} total profit`);
  if (aiData?.tips) matchReasons.push(aiData.tips);
  
  return {
    itemName: item.itemName,
    itemId: item.itemId || 0,
    itemIcon: item.itemIcon || undefined,
    currentPrice: item.avgSellPrice, // Use their historical sell price as "current"
    suggestedBuyPrice: item.avgBuyPrice,
    suggestedSellPrice: item.avgSellPrice,
    potentialProfit,
    potentialROI,
    confidence,
    reasoning,
    matchScore: aiData?.matchScore || Math.round(50 + (item.winRate / 2)),
    matchReasons,
    strategy: aiData?.strategy || item.strategies[0] || "Other",
    riskLevel,
    estimatedHoldTime,
  };
}

// Fallback: return top profit items
function getTopProfitItems(items: ItemTradingStats[], profile: UserTradingProfile): PersonalizedRecommendation[] {
  return items
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 5)
    .map(item => buildRecommendation(item, profile, "Top profit performer from your history"));
}

function formatGp(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function formatHoldTime(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) return "less than 1 hour";
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  return `${Math.round(days)} days`;
}
