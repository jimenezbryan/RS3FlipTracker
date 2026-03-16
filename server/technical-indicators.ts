import type { PriceHistoryPoint } from "./ge-api";

export interface TechnicalIndicators {
  rsi14: number | null;
  sma7: number | null;
  sma30: number | null;
  sma200: number | null;
  smaCrossover: "bullish" | "bearish" | "neutral";
  volatilityPct: number;
  priceVsAvg30: number;
  support: number | null;
  resistance: number | null;
  valueGap: ValueGapAnalysis | null;
}

export interface ValueGapAnalysis {
  fairValue: number;
  currentPrice: number;
  gapPct: number;
  gapDirection: "undervalued" | "overvalued" | "fair";
  signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
}

export interface SmartPricing {
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  suggestedMarginPct: number;
  priceTier: "low" | "mid" | "high" | "ultra";
  confidence: "high" | "medium" | "low";
}

export interface TradeHistoryStats {
  tradeCount: number;
  avgActualMarginPct: number;
  avgActualROI: number;
  avgHoldTimeHours: number;
  winRate: number;
  lastTradeDate: string | null;
  modelGap: number;
}

export interface ObservableRange {
  low: number;
  high: number;
  current: number;
  spreadPct: number;
  percentile: number;
}

export function calculateObservableRange(history: PriceHistoryPoint[], days: number): ObservableRange | null {
  if (history.length === 0) return null;
  const recent = history.slice(-days);
  if (recent.length < 2) return null;

  const prices = recent.map(h => h.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const current = prices[prices.length - 1];

  if (low === 0) return null;
  const spreadPct = Math.round(((high - low) / low) * 10000) / 100;
  const range = high - low;
  const percentile = range > 0 ? Math.round(((current - low) / range) * 100) : 50;

  return { low, high, current, spreadPct, percentile };
}

export function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  const recent = prices.slice(-period - 1);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i++) {
    const change = recent[i] - recent[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const recent = prices.slice(-period);
  return Math.round(recent.reduce((a, b) => a + b, 0) / period);
}

export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const recent = prices.slice(-30);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (mean === 0) return 0;
  const squaredDiffs = recent.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  return Math.round((stdDev / mean) * 10000) / 100;
}

export function findSupportResistance(prices: number[]): { support: number | null; resistance: number | null } {
  if (prices.length < 10) return { support: null, resistance: null };
  const recent = prices.slice(-30);
  const sorted = [...recent].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.1);
  const q3Index = Math.floor(sorted.length * 0.9);
  return {
    support: sorted[q1Index],
    resistance: sorted[q3Index],
  };
}

export function calculateValueGap(
  currentPrice: number,
  sma30: number | null,
  sma200: number | null,
): ValueGapAnalysis | null {
  const anchors: number[] = [];
  if (sma30 !== null) anchors.push(sma30);
  if (sma200 !== null) anchors.push(sma200);
  if (anchors.length === 0) return null;

  const fairValue = Math.round(anchors.reduce((a, b) => a + b, 0) / anchors.length);
  if (fairValue === 0) return null;

  const gapPct = Math.round(((currentPrice - fairValue) / fairValue) * 10000) / 100;

  let gapDirection: "undervalued" | "overvalued" | "fair" = "fair";
  if (gapPct < -3) gapDirection = "undervalued";
  else if (gapPct > 3) gapDirection = "overvalued";

  let signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" = "hold";
  if (gapPct < -10) signal = "strong_buy";
  else if (gapPct < -3) signal = "buy";
  else if (gapPct > 10) signal = "strong_sell";
  else if (gapPct > 3) signal = "sell";

  return { fairValue, currentPrice, gapPct, gapDirection, signal };
}

export function calculateTechnicalIndicators(history: PriceHistoryPoint[]): TechnicalIndicators {
  const prices = history.map(h => h.price);

  const rsi14 = calculateRSI(prices);
  const sma7 = calculateSMA(prices, 7);
  const sma30 = calculateSMA(prices, 30);
  const sma200 = calculateSMA(prices, 200);

  let smaCrossover: "bullish" | "bearish" | "neutral" = "neutral";
  if (sma7 !== null && sma30 !== null) {
    const diff = (sma7 - sma30) / sma30;
    if (diff > 0.01) smaCrossover = "bullish";
    else if (diff < -0.01) smaCrossover = "bearish";
  }

  const volatilityPct = calculateVolatility(prices);

  let priceVsAvg30 = 0;
  if (sma30 !== null && prices.length > 0) {
    const currentPrice = prices[prices.length - 1];
    priceVsAvg30 = Math.round(((currentPrice - sma30) / sma30) * 10000) / 100;
  }

  const { support, resistance } = findSupportResistance(prices);

  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const valueGap = calculateValueGap(currentPrice, sma30, sma200);

  return {
    rsi14,
    sma7,
    sma30,
    sma200,
    smaCrossover,
    volatilityPct,
    priceVsAvg30,
    support,
    resistance,
    valueGap,
  };
}

export function getPriceTier(price: number): "low" | "mid" | "high" | "ultra" {
  if (price < 1000) return "low";
  if (price < 1000000) return "mid";
  if (price < 100000000) return "high";
  return "ultra";
}

const TIER_MARGINS: Record<string, { base: number; min: number; max: number }> = {
  low: { base: 0.075, min: 0.05, max: 0.10 },
  mid: { base: 0.035, min: 0.02, max: 0.05 },
  high: { base: 0.02, min: 0.01, max: 0.03 },
  ultra: { base: 0.01, min: 0.005, max: 0.015 },
};

export function calculateSmartPricing(
  currentPrice: number,
  indicators: TechnicalIndicators | null,
  tradeStats: TradeHistoryStats | null,
): SmartPricing {
  const tier = getPriceTier(currentPrice);
  const tierConfig = TIER_MARGINS[tier];

  let marginPct = tierConfig.base;

  if (indicators) {
    if (indicators.volatilityPct > 5) {
      marginPct *= 1.3;
    } else if (indicators.volatilityPct > 3) {
      marginPct *= 1.15;
    } else if (indicators.volatilityPct < 1) {
      marginPct *= 0.85;
    }

    if (indicators.rsi14 !== null) {
      if (indicators.rsi14 < 30) {
        marginPct *= 1.2;
      } else if (indicators.rsi14 > 70) {
        marginPct *= 0.85;
      }
    }

    if (indicators.smaCrossover === "bullish") {
      marginPct *= 1.1;
    } else if (indicators.smaCrossover === "bearish") {
      marginPct *= 0.9;
    }
  }

  let confidence: "high" | "medium" | "low" = "low";

  if (tradeStats && tradeStats.tradeCount >= 3) {
    const actualMargin = tradeStats.avgActualMarginPct / 100;
    if (actualMargin > 0) {
      const blendWeight = Math.min(tradeStats.tradeCount / 10, 0.7);
      marginPct = marginPct * (1 - blendWeight) + actualMargin * blendWeight;
    }
    confidence = tradeStats.tradeCount >= 10 ? "high" : "medium";
  } else if (indicators && indicators.rsi14 !== null) {
    confidence = "medium";
  }

  marginPct = Math.max(tierConfig.min, Math.min(tierConfig.max, marginPct));

  const halfMargin = marginPct / 2;
  const suggestedBuyPrice = Math.round(currentPrice * (1 - halfMargin));
  const suggestedSellPrice = Math.round(currentPrice * (1 + halfMargin));

  return {
    suggestedBuyPrice,
    suggestedSellPrice,
    suggestedMarginPct: Math.round(marginPct * 10000) / 100,
    priceTier: tier,
    confidence,
  };
}

export function calculateTradeHistoryStats(
  flips: Array<{
    buyPrice: number;
    sellPrice: number | null;
    quantity: number;
    buyDate: string | Date;
    sellDate: string | Date | null;
    itemId?: number | null;
    itemName?: string | null;
  }>,
  suggestedMarginPct: number,
): TradeHistoryStats {
  const completedFlips = flips.filter(f => f.sellPrice !== null && f.sellDate !== null);

  if (completedFlips.length === 0) {
    return {
      tradeCount: 0,
      avgActualMarginPct: 0,
      avgActualROI: 0,
      avgHoldTimeHours: 0,
      winRate: 0,
      lastTradeDate: null,
      modelGap: 0,
    };
  }

  let totalMarginPct = 0;
  let totalROI = 0;
  let totalHoldMs = 0;
  let wins = 0;

  for (const flip of completedFlips) {
    const buy = Number(flip.buyPrice);
    const sell = Number(flip.sellPrice!);
    const margin = sell - buy;
    const marginPct = buy > 0 ? (margin / buy) * 100 : 0;
    totalMarginPct += marginPct;

    const taxPerItem = sell <= 49 ? 0 : Math.floor(sell * 0.02);
    const netProfit = (margin * flip.quantity) - (taxPerItem * flip.quantity);
    const investment = buy * flip.quantity;
    const roi = investment > 0 ? (netProfit / investment) * 100 : 0;
    totalROI += roi;

    if (netProfit > 0) wins++;

    const buyDate = new Date(flip.buyDate);
    const sellDate = new Date(flip.sellDate!);
    totalHoldMs += sellDate.getTime() - buyDate.getTime();
  }

  const count = completedFlips.length;
  const avgActualMarginPct = totalMarginPct / count;
  const avgActualROI = totalROI / count;
  const avgHoldTimeHours = totalHoldMs / count / (1000 * 60 * 60);
  const winRate = (wins / count) * 100;

  const dates = completedFlips
    .map(f => new Date(f.sellDate!).getTime())
    .sort((a, b) => b - a);
  const lastTradeDate = dates.length > 0 ? new Date(dates[0]).toISOString().split("T")[0] : null;

  const modelGap = avgActualMarginPct - suggestedMarginPct;

  return {
    tradeCount: count,
    avgActualMarginPct: Math.round(avgActualMarginPct * 100) / 100,
    avgActualROI: Math.round(avgActualROI * 100) / 100,
    avgHoldTimeHours: Math.round(avgHoldTimeHours * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
    lastTradeDate,
    modelGap: Math.round(modelGap * 100) / 100,
  };
}
