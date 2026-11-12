import { formatGpShorthand } from "@shared/gpParser";

// ponytail: kept as a name so its 46 call sites don't change; the format lives in shared/gpParser (#17).
export const formatGP = formatGpShorthand;

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
