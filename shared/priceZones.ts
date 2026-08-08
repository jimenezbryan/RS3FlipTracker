/**
 * Buy / Sell / Accumulation zones and moving averages for the price chart.
 *
 * Lives in shared/ rather than inside the chart component on purpose: the Scanner's signal
 * scoring is stuck in a React useMemo and cannot be tested headless, which two project logs
 * now record as a standing problem. This is the same class of logic, so it goes somewhere
 * `npx tsx` can reach it. See scripts/check-price-zones.ts.
 *
 * Zones are computed from the VISIBLE window, so switching 24H/7D/90D recomputes them. That
 * is a deliberate choice: the bands always describe the candles you can see. It also means
 * the 24H and 90D views can disagree about the same item at the same moment — that is the
 * accepted cost, not a bug.
 */

export interface ZonePoint {
  price: number;
  volume?: number;
}

export type Zone = "buy" | "sell" | "accumulation" | "neutral";

export interface PriceZones {
  /** Top of the buy zone — the 25th percentile of prices in the window. */
  buyMax: number;
  /** Bottom of the sell zone — the 75th percentile. */
  sellMin: number;
  low: number;
  high: number;
  current: number;
  /** Which zone the latest price falls in. */
  zone: Zone;
  /** Middle band + elevated volume. Matches Scanner's "Accumulation" signal: being bought
   *  up without the price running away yet. */
  accumulating: boolean;
  /** Median volume over the last quarter of the window, and over the whole window.
   *  null when the series carries no volume. */
  recentVolume: number | null;
  baseVolume: number | null;
}

/** Linear-interpolated quantile. Quantile of the price distribution, not position in the
 *  min-max range: one spike shifts a range-based cut by the full spike, a quantile barely
 *  moves. `findSupportResistance` already takes the quantile approach. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/** ponytail: fixed quartiles. The 25/75 cut is the one judgement call here — everything
 *  else is measured off real prices. Move them together if the bands feel too wide. */
export const BUY_QUANTILE = 0.25;
export const SELL_QUANTILE = 0.75;

/** Fraction of the window treated as "recent" when deciding if volume is elevated. */
const RECENT_FRACTION = 0.25;

export function calculatePriceZones(points: ZonePoint[]): PriceZones | null {
  // Two points give a degenerate distribution — quartiles would just be the two prices.
  if (points.length < 4) return null;

  const prices = points.map((p) => p.price).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length < 4) return null;

  const sorted = [...prices].sort((a, b) => a - b);
  const buyMax = quantile(sorted, BUY_QUANTILE);
  const sellMin = quantile(sorted, SELL_QUANTILE);
  const current = prices[prices.length - 1];

  // Volume is optional — WeirdGloop daily history carries it, but not every series does.
  const volumes = points.map((p) => p.volume).filter((v): v is number => Number.isFinite(v));
  const hasVolume = volumes.length === points.length && volumes.some((v) => v > 0);
  const recentCount = Math.max(1, Math.round(points.length * RECENT_FRACTION));
  const recentVolume = hasVolume ? median(volumes.slice(-recentCount)) : null;
  const baseVolume = hasVolume ? median(volumes) : null;

  const inMiddle = current > buyMax && current < sellMin;
  const accumulating =
    inMiddle && recentVolume != null && baseVolume != null && recentVolume > baseVolume;

  const zone: Zone =
    current <= buyMax ? "buy" : current >= sellMin ? "sell" : accumulating ? "accumulation" : "neutral";

  return {
    buyMax,
    sellMin,
    low: sorted[0],
    high: sorted[sorted.length - 1],
    current,
    zone,
    accumulating,
    recentVolume,
    baseVolume,
  };
}

/** Trailing simple moving average, aligned to the input. Leading entries are null rather
 *  than a short-window average, so the line starts where it is actually meaningful instead
 *  of hugging the first price. */
export function movingAverage(values: number[], period: number): (number | null)[] {
  if (period < 1) return values.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? Math.round(sum / period) : null);
  }
  return out;
}

export const ZONE_LABELS: Record<Zone, string> = {
  buy: "Buy Zone",
  sell: "Sell Zone",
  accumulation: "Accumulation",
  neutral: "Neutral",
};
