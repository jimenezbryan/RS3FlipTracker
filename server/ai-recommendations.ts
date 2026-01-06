import OpenAI from "openai";
import type { Flip } from "@shared/schema";
import { getItemPrice, getItemPriceHistory, searchItems } from "./ge-api";

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

export async function getPersonalizedRecommendations(
  profile: UserTradingProfile,
  existingFlips: Flip[]
): Promise<PersonalizedRecommendation[]> {
  const openPositions = existingFlips
    .filter(f => !f.sellPrice && !f.deletedAt)
    .map(f => f.itemName.toLowerCase());
  
  const prompt = `You are an expert RuneScape 3 Grand Exchange trading advisor. Based on a user's trading profile, suggest 5 specific items they should consider flipping.

USER TRADING PROFILE:
- Risk Profile: ${profile.riskProfile}
- Preferred Price Range: ${formatGp(profile.preferredPriceRange.min)} - ${formatGp(profile.preferredPriceRange.max)}
- Average ROI: ${profile.avgROI.toFixed(1)}%
- Win Rate: ${profile.winRate.toFixed(1)}%
- Average Hold Time: ${formatHoldTime(profile.avgHoldTime)}
- Total Completed Flips: ${profile.totalFlips}
- Membership Preference: ${profile.membershipPreference}
- Top Performing Items: ${profile.topPerformingItems.map(i => i.name).join(", ") || "None yet"}
- Frequently Traded: ${profile.frequentlyTradedItems.join(", ") || "None yet"}
- Preferred Strategies: ${profile.preferredStrategies.map(s => `${s.strategy} (${s.frequency} trades, ${s.avgROI.toFixed(1)}% avg ROI)`).join(", ") || "None yet"}
- Currently Open Positions: ${openPositions.join(", ") || "None"}

REQUIREMENTS:
1. Suggest items that match the user's risk profile and price range
2. Consider their preferred trading strategies
3. Avoid items they already have open positions in
4. Include a mix of familiar categories and new opportunities
5. Each item must be a real RS3 tradeable item

Respond with a valid JSON array:
[
  {
    "itemName": "Exact RS3 item name",
    "reasoning": "Brief explanation why this fits the user's style",
    "strategy": "Fast Flip|Slow Flip|Bulk|High Margin|Speculative",
    "riskLevel": "low|medium|high",
    "estimatedHoldTime": "e.g., 1-2 hours, 1-3 days",
    "matchScore": 0-100,
    "matchReasons": ["reason1", "reason2"]
  }
]`;

  try {
    console.log("[AI Recommendations] Generating recommendations for profile:", {
      totalFlips: profile.totalFlips,
      avgROI: profile.avgROI,
      preferredStrategies: profile.preferredStrategies.slice(0, 3),
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an RS3 GE trading expert. Only suggest real, tradeable RS3 items. Always respond with a JSON object containing an 'items' array." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    console.log("[AI Recommendations] OpenAI raw response:", content?.substring(0, 500));
    
    if (!content) {
      console.log("[AI Recommendations] No content in response, using fallback");
      return getFallbackRecommendations(profile, openPositions);
    }

    const parsed = JSON.parse(content);
    
    // Handle various response formats from OpenAI
    let suggestions: any[] = [];
    if (Array.isArray(parsed)) {
      suggestions = parsed;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      suggestions = parsed.items;
    } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      suggestions = parsed.recommendations;
    } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions;
    } else {
      // Try to find any array in the parsed object
      const arrayKeys = Object.keys(parsed).filter(k => Array.isArray(parsed[k]));
      if (arrayKeys.length > 0) {
        suggestions = parsed[arrayKeys[0]];
      }
    }
    
    console.log("[AI Recommendations] Parsed suggestions count:", suggestions.length);
    
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.log("[AI Recommendations] No valid suggestions, using fallback");
      return getFallbackRecommendations(profile, openPositions);
    }

    const recommendations: PersonalizedRecommendation[] = [];
    
    for (const suggestion of suggestions.slice(0, 5)) {
      try {
        if (!suggestion || !suggestion.itemName) {
          console.log("[AI Recommendations] Skipping suggestion - no itemName");
          continue;
        }
        
        console.log("[AI Recommendations] Looking up item:", suggestion.itemName);
        const searchResults = await searchItems(suggestion.itemName);
        if (!searchResults || searchResults.length === 0) {
          console.log("[AI Recommendations] Item not found in GE:", suggestion.itemName);
          continue;
        }
        
        const item = searchResults[0];
        if (!item || typeof item.price !== 'number' || item.price <= 0 || !item.id) {
          console.log("[AI Recommendations] Invalid item data for:", suggestion.itemName, { price: item?.price, id: item?.id });
          continue;
        }
        
        console.log("[AI Recommendations] Found item:", item.name, "Price:", item.price);
        
        const history = await getItemPriceHistory(item.id);
        
        let suggestedBuyPrice = item.price;
        let suggestedSellPrice = item.price;
        
        if (history && history.length > 0) {
          const prices = history.map(h => h.price);
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          suggestedBuyPrice = Math.round(avgPrice * 0.97);
          suggestedSellPrice = Math.round(avgPrice * 1.03);
          
          if (suggestion.strategy === "High Margin") {
            suggestedBuyPrice = Math.round(minPrice * 1.02);
            suggestedSellPrice = Math.round(maxPrice * 0.98);
          } else if (suggestion.strategy === "Fast Flip") {
            suggestedBuyPrice = Math.round(avgPrice * 0.99);
            suggestedSellPrice = Math.round(avgPrice * 1.01);
          }
        }
        
        if (isNaN(suggestedBuyPrice) || isNaN(suggestedSellPrice) || suggestedBuyPrice <= 0) continue;
        
        const potentialProfit = suggestedSellPrice - suggestedBuyPrice - Math.floor(suggestedSellPrice * 0.02); // 2% tax per item
        const potentialROI = suggestedBuyPrice > 0 ? (potentialProfit / suggestedBuyPrice) * 100 : 0;
        
        let confidence: "high" | "medium" | "low" = "medium";
        const matchScore = typeof suggestion.matchScore === 'number' ? suggestion.matchScore : 70;
        if (matchScore >= 80) confidence = "high";
        else if (matchScore < 50) confidence = "low";
        
        recommendations.push({
          itemName: item.name,
          itemId: item.id,
          itemIcon: item.icon,
          currentPrice: item.price,
          suggestedBuyPrice,
          suggestedSellPrice,
          potentialProfit,
          potentialROI,
          confidence,
          reasoning: suggestion.reasoning || "Matches your trading profile",
          matchScore,
          matchReasons: Array.isArray(suggestion.matchReasons) ? suggestion.matchReasons : [],
          strategy: suggestion.strategy || "Other",
          riskLevel: suggestion.riskLevel || "medium",
          estimatedHoldTime: suggestion.estimatedHoldTime || "1-3 days",
        });
      } catch (err) {
        console.error(`Failed to look up item: ${suggestion.itemName}`, err);
      }
    }
    
    // If no AI recommendations worked, try fallback
    if (recommendations.length === 0) {
      console.log("[AI Recommendations] No AI items validated, using fallback");
      return getFallbackRecommendations(profile, openPositions);
    }
    
    console.log("[AI Recommendations] Returning", recommendations.length, "AI-generated recommendations");
    return recommendations;
  } catch (error) {
    console.error("[AI Recommendations] Error generating recommendations:", error);
    // Return fallback recommendations on error
    return getFallbackRecommendations(profile, openPositions);
  }
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

// Popular items to recommend as fallback when AI suggestions fail
const FALLBACK_ITEMS = [
  { name: "Nature rune", strategy: "Bulk", risk: "low" as const },
  { name: "Death rune", strategy: "Bulk", risk: "low" as const },
  { name: "Blood rune", strategy: "Bulk", risk: "low" as const },
  { name: "Fire rune", strategy: "Bulk", risk: "low" as const },
  { name: "Super restore (4)", strategy: "Fast Flip", risk: "low" as const },
  { name: "Prayer potion (4)", strategy: "Fast Flip", risk: "low" as const },
  { name: "Saradomin brew (4)", strategy: "Fast Flip", risk: "low" as const },
  { name: "Overload (4)", strategy: "Fast Flip", risk: "medium" as const },
  { name: "Raw rocktail", strategy: "Bulk", risk: "low" as const },
  { name: "Rocktail", strategy: "Bulk", risk: "low" as const },
  { name: "Luminite stone spirit", strategy: "Bulk", risk: "low" as const },
  { name: "Necrite stone spirit", strategy: "Bulk", risk: "low" as const },
  { name: "Elder rune bar", strategy: "Slow Flip", risk: "medium" as const },
  { name: "Onyx bolt tips", strategy: "High Margin", risk: "medium" as const },
  { name: "Ascension shard", strategy: "Bulk", risk: "low" as const },
];

async function getFallbackRecommendations(
  profile: UserTradingProfile,
  openPositions: string[]
): Promise<PersonalizedRecommendation[]> {
  console.log("[AI Recommendations] Using fallback recommendations");
  
  const recommendations: PersonalizedRecommendation[] = [];
  
  // Filter out items user already has open positions in
  const availableItems = FALLBACK_ITEMS.filter(
    item => !openPositions.includes(item.name.toLowerCase())
  );
  
  // Pick items based on profile preferences
  let selectedItems = availableItems;
  
  // Prioritize items matching user's preferred strategies
  const preferredStrategies = profile.preferredStrategies.map(s => s.strategy);
  if (preferredStrategies.length > 0) {
    selectedItems = [
      ...availableItems.filter(item => preferredStrategies.includes(item.strategy)),
      ...availableItems.filter(item => !preferredStrategies.includes(item.strategy))
    ];
  }
  
  for (const fallbackItem of selectedItems.slice(0, 5)) {
    try {
      const searchResults = await searchItems(fallbackItem.name);
      if (!searchResults || searchResults.length === 0) continue;
      
      const item = searchResults[0];
      if (!item || typeof item.price !== 'number' || item.price <= 0 || !item.id) continue;
      
      // Skip if outside user's price range
      if (item.price < profile.preferredPriceRange.min * 0.1 || 
          item.price > profile.preferredPriceRange.max * 10) {
        continue;
      }
      
      const history = await getItemPriceHistory(item.id);
      
      let suggestedBuyPrice = item.price;
      let suggestedSellPrice = item.price;
      
      if (history && history.length > 0) {
        const prices = history.map(h => h.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        if (fallbackItem.strategy === "Fast Flip") {
          suggestedBuyPrice = Math.round(avgPrice * 0.99);
          suggestedSellPrice = Math.round(avgPrice * 1.01);
        } else if (fallbackItem.strategy === "Bulk") {
          suggestedBuyPrice = Math.round(avgPrice * 0.98);
          suggestedSellPrice = Math.round(avgPrice * 1.02);
        } else {
          suggestedBuyPrice = Math.round(avgPrice * 0.97);
          suggestedSellPrice = Math.round(avgPrice * 1.03);
        }
      }
      
      const potentialProfit = suggestedSellPrice - suggestedBuyPrice - Math.floor(suggestedSellPrice * 0.02);
      const potentialROI = suggestedBuyPrice > 0 ? (potentialProfit / suggestedBuyPrice) * 100 : 0;
      
      recommendations.push({
        itemName: item.name,
        itemId: item.id,
        itemIcon: item.icon,
        currentPrice: item.price,
        suggestedBuyPrice,
        suggestedSellPrice,
        potentialProfit,
        potentialROI,
        confidence: "medium",
        reasoning: `Popular ${fallbackItem.strategy.toLowerCase()} item with consistent trading volume`,
        matchScore: 65,
        matchReasons: ["High volume item", "Reliable price margins"],
        strategy: fallbackItem.strategy,
        riskLevel: fallbackItem.risk,
        estimatedHoldTime: fallbackItem.strategy === "Fast Flip" ? "1-4 hours" : "1-2 days",
      });
    } catch (err) {
      console.error(`[AI Recommendations] Fallback item lookup failed: ${fallbackItem.name}`, err);
    }
  }
  
  console.log("[AI Recommendations] Fallback generated", recommendations.length, "recommendations");
  return recommendations;
}
