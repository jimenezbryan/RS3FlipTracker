export function formatGP(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Exact gp, thousands-separated.
 *
 * formatGP's "2.86M" is fine for a glance and useless for a decision: the Grand Exchange
 * takes an exact number, and 2.86M spans a 5,000gp band — wider than most of the spreads
 * this table is built to find. Anything you would type into an offer box uses this.
 */
export function formatGPExact(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
