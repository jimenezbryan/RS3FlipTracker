import type { PriceHistoryPoint } from "./ge-api";

/**
 * Every window here is a span of TIME, not a count of data points, and every field is
 * nullable so a window with too little data reports nothing rather than something wrong.
 *
 * Both of those are scars. The previous shape had `sma7`/`sma30`/`sma200` fed from the
 * MONTHLY-aggregated series, so "7" meant seven months and rendered in the UI beside a
 * genuinely date-based "7-Day Avg" that disagreed with it by 25%. `priceVsAvg30` was a plain
 * number initialised to 0 and only assigned when `sma30` existed — and with fewer than 30
 * monthly points it never existed, so the panel displayed "0.00%" (a confident "price is
 * exactly at its average") for what was really "no idea". A count-based window silently
 * changes meaning with the sampling rate; a non-nullable number cannot say "unknown".
 */
export interface TechnicalIndicators {
  rsi14: number | null;
  avg7d: number | null;
  avg30d: number | null;
  avg90d: number | null;
  /** avg7d against avg30d. */
  smaCrossover: "bullish" | "bearish" | "neutral";
  volatilityPct: number | null;
  priceVsAvg30: number | null;
  support: number | null;
  resistance: number | null;
  valueGap: ValueGapAnalysis | null;
}

/** An average of one point is that point. Two is the minimum that averages anything. */
const MIN_POINTS_FOR_AVERAGE = 2;
/** A standard deviation over two or three points is noise wearing a percentage sign. */
const MIN_POINTS_FOR_VOLATILITY = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Prices from the last `days` days. The whole point is that this is not `slice(-days)`. */
export function pricesWithinDays(history: PriceHistoryPoint[], days: number): number[] {
  const cutoff = Date.now() - days * DAY_MS;
  return history.filter((h) => new Date(h.date).getTime() >= cutoff).map((h) => h.price);
}

function meanOrNull(prices: number[]): number | null {
  if (prices.length < MIN_POINTS_FOR_AVERAGE) return null;
  return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
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
  // Same fix as the indicators: a "7-day range" must span seven days, not seven samples.
  const prices = pricesWithinDays(history, days);
  if (prices.length < MIN_POINTS_FOR_AVERAGE) return null;

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

/** Takes an already-windowed series — the caller decides the span, in days. */
export function calculateVolatility(prices: number[]): number | null {
  if (prices.length < MIN_POINTS_FOR_VOLATILITY) return null;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (mean === 0) return null;
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  return Math.round((stdDev / mean) * 10000) / 100;
}

/** Takes an already-windowed series. Ten points is the floor for a meaningful decile. */
export function findSupportResistance(prices: number[]): { support: number | null; resistance: number | null } {
  if (prices.length < 10) return { support: null, resistance: null };
  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.1);
  const q3Index = Math.floor(sorted.length * 0.9);
  return {
    support: sorted[q1Index],
    resistance: sorted[q3Index],
  };
}

export function calculateValueGap(
  currentPrice: number,
  avg30d: number | null,
  avg90d: number | null,
): ValueGapAnalysis | null {
  const anchors: number[] = [];
  if (avg30d !== null) anchors.push(avg30d);
  if (avg90d !== null) anchors.push(avg90d);
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

/**
 * Pass the DAILY series. Passing the monthly one is what produced a "7-day" average covering
 * seven months, so the windows below are cut by date and a monthly series simply yields nulls
 * instead of quietly answering a different question.
 */
export function calculateTechnicalIndicators(history: PriceHistoryPoint[]): TechnicalIndicators {
  const prices = history.map(h => h.price);
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;

  const window30d = pricesWithinDays(history, 30);

  const avg7d = meanOrNull(pricesWithinDays(history, 7));
  const avg30d = meanOrNull(window30d);
  const avg90d = meanOrNull(pricesWithinDays(history, 90));

  // RSI keeps period semantics — it is defined over consecutive periods, not a date span —
  // but it is only meaningful on a regularly sampled series, which is why it gets the daily
  // one. It already returns null below its minimum.
  const rsi14 = calculateRSI(prices);

  let smaCrossover: "bullish" | "bearish" | "neutral" = "neutral";
  if (avg7d !== null && avg30d !== null) {
    const diff = (avg7d - avg30d) / avg30d;
    if (diff > 0.01) smaCrossover = "bullish";
    else if (diff < -0.01) smaCrossover = "bearish";
  }

  const volatilityPct = calculateVolatility(window30d);

  const priceVsAvg30 =
    avg30d !== null && avg30d !== 0 && prices.length > 0
      ? Math.round(((currentPrice - avg30d) / avg30d) * 10000) / 100
      : null;

  // Support and resistance describe where price is trading now. Cut to 30 days for the same
  // reason as the rest: over a multi-year window this returned a "support" above the current
  // price and a "resistance" at five times it, which are not levels anyone can trade against.
  //
  // The window fixes the cause, but the deciles can still land the wrong side of price after
  // a sharp move — and a "support" above the current price is a contradiction in terms, not a
  // level. Report nothing rather than a number that cannot mean what its name says.
  let { support, resistance } = findSupportResistance(window30d);
  if (support !== null && support > currentPrice) support = null;
  if (resistance !== null && resistance < currentPrice) resistance = null;

  const valueGap = calculateValueGap(currentPrice, avg30d, avg90d);

  return {
    rsi14,
    avg7d,
    avg30d,
    avg90d,
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
    // Unknown volatility leaves the tier base alone. Treating null as 0 would have widened
    // the margin as though the item were provably calm.
    if (indicators.volatilityPct !== null) {
      if (indicators.volatilityPct > 5) {
        marginPct *= 1.3;
      } else if (indicators.volatilityPct > 3) {
        marginPct *= 1.15;
      } else if (indicators.volatilityPct < 1) {
        marginPct *= 0.85;
      }
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
