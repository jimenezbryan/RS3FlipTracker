/**
 * What the price chart currently shows: the zoom slice, the trades inside it, and the y-axis
 * bounds those imply.
 *
 * This was inline in PriceHistoryChart and it was wrong in a way that made the chart unusable:
 * user trades were fed into the y-domain unconditionally, so a months-old trade at a price the
 * item no longer trades at stretched the axis to reach it. The price line collapsed into a
 * sliver and the "top 25%" band, drawn up to that inflated ceiling, painted most of the plot
 * red. Extracted here so the arithmetic is checkable without a browser — the fifth shared/
 * module for that reason.
 */

export interface WindowPoint {
  /** Epoch ms. */
  timestamp: number;
  price: number;
}

export interface WindowTrade {
  timestamp: number;
  price: number;
}

export interface ChartWindow<P extends WindowPoint, T extends WindowTrade> {
  /** The points on screen. */
  visible: P[];
  /** Index range actually used, after clamping. */
  startIndex: number;
  endIndex: number;
  isZoomed: boolean;
  windowStart: number;
  windowEnd: number;
  /** Only trades whose timestamp falls inside the window. */
  visibleTrades: T[];
  /** Trades excluded by the window — reported, not silently dropped. */
  hiddenTradeCount: number;
  /** Y bounds, padded. Null when there is nothing to draw. */
  yMin: number;
  yMax: number;
}

/** Share of the price span left as breathing room above and below. */
const PAD_FRACTION = 0.1;

export function chartWindow<P extends WindowPoint, T extends WindowTrade>(
  points: P[],
  trades: T[],
  zoom: { start: number; end: number } | null,
): ChartWindow<P, T> | null {
  if (points.length === 0) return null;

  // Clamped on read, not on write: a stale index left behind by a timeframe switch must not
  // be able to index past the end of a shorter series.
  const lastIndex = points.length - 1;
  const startIndex = Math.min(Math.max(zoom?.start ?? 0, 0), lastIndex);
  const endIndex = Math.min(Math.max(zoom?.end ?? lastIndex, startIndex), lastIndex);

  const visible = points.slice(startIndex, endIndex + 1);
  const windowStart = visible[0].timestamp;
  const windowEnd = visible[visible.length - 1].timestamp;

  const visibleTrades = trades.filter(
    (t) => t.timestamp >= windowStart && t.timestamp <= windowEnd,
  );

  const prices = [...visible.map((p) => p.price), ...visibleTrades.map((t) => t.price)];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  // A flat series has no span to take a fraction of, and a flat series at zero has no
  // magnitude either — hence the final literal, which keeps yMin < yMax in every case.
  const padding = (maxPrice - minPrice) * PAD_FRACTION || Math.abs(maxPrice) * 0.05 || 1;

  return {
    visible,
    startIndex,
    endIndex,
    isZoomed: startIndex > 0 || endIndex < lastIndex,
    windowStart,
    windowEnd,
    visibleTrades,
    hiddenTradeCount: trades.length - visibleTrades.length,
    yMin: minPrice - padding,
    yMax: maxPrice + padding,
  };
}
