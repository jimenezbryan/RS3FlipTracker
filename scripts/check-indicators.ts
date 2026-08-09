/**
 * Self-check for the technical indicators' windowing and null semantics.
 * Run: npx tsx scripts/check-indicators.ts
 * Offline, assert-based, no framework.
 *
 * Both bugs this guards were visible on screen for a long time without anyone being able to
 * tell, because both produced plausible numbers rather than obvious breakage:
 *
 *   1. Windows were `slice(-n)` — n SAMPLES, not n days — and the route fed the function the
 *      MONTHLY series. "7" meant seven months. The panel showed a 7-day average of 22.26M
 *      beside a genuinely date-based 7-Day Avg of 17.91M and neither looked wrong alone.
 *   2. `priceVsAvg30` was a non-nullable number initialised to 0, only assigned when the
 *      30-window existed. With too little data it rendered "0.00%" — which reads as "price is
 *      exactly at its 30-day average", the opposite of "unknown".
 *
 * The sparse fixture below is the real shape: monthly-ish sampling, which is what made a
 * count-based window silently answer a different question.
 */
import assert from "node:assert/strict";
import {
  calculateTechnicalIndicators,
  calculateObservableRange,
  calculateVolatility,
  findSupportResistance,
  pricesWithinDays,
} from "../server/technical-indicators";
import type { PriceHistoryPoint } from "../server/ge-api";

const DAY = 24 * 60 * 60 * 1000;
/**
 * n days ago plus half a day, so no fixture point ever lands exactly on a window cutoff.
 * Without the offset a sample dated exactly 7 days ago falls inside or outside the 7-day
 * window depending on the milliseconds between building the fixture and reading Date.now(),
 * which makes the check flaky rather than wrong.
 */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY - DAY / 2).toISOString();

/** One point per day for `n` days, oldest first. */
const dailySeries = (n: number, priceAt: (i: number) => number): PriceHistoryPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: daysAgo(n - 1 - i), price: priceAt(i) }));

// ── 1. Windows are days, not samples ────────────────────────────────────────────
// The fixture that broke it: 12 points spread one per month, like the monthly series the
// route used to pass in. A count-based window would happily average all twelve and call the
// result "30-day".
// 31-day spacing, so the 30-day window holds exactly one sample. At exactly 30 the boundary
// point is legitimately inside the window and two samples do average to something real.
const monthlyish: PriceHistoryPoint[] = Array.from({ length: 12 }, (_, i) => ({
  date: daysAgo((11 - i) * 31),
  price: 30_000_000 - i * 1_000_000,
}));

const sparse = calculateTechnicalIndicators(monthlyish);
assert.equal(sparse.avg7d, null, "7 days containing one sample cannot yield an average");
assert.equal(sparse.avg30d, null, "30 days containing one sample cannot yield an average");
assert.equal(
  sparse.priceVsAvg30,
  null,
  'the old code reported 0.00% here — "exactly at average" instead of "unknown"',
);
assert.equal(sparse.volatilityPct, null, "a stdev needs more than a couple of points");
assert.equal(sparse.support, null, "no support level from a 30-day window holding one sample");
assert.equal(sparse.resistance, null, "no resistance level either");

// The specific regression: a count-based 7 would have averaged seven MONTHS of this series.
const sevenMonthMean = Math.round(
  monthlyish.slice(-7).reduce((s, p) => s + p.price, 0) / 7,
);
assert.notEqual(sparse.avg7d, sevenMonthMean, "avg7d must never be the mean of the last 7 samples");

// ── 2. A real daily series produces real windows ────────────────────────────────
const flat = dailySeries(90, () => 1_000);
const dense = calculateTechnicalIndicators(flat);
assert.equal(dense.avg7d, 1_000, "flat prices average to the price");
assert.equal(dense.avg30d, 1_000);
assert.equal(dense.avg90d, 1_000);
assert.equal(dense.priceVsAvg30, 0, "flat really is 0% from its average — 0 is a valid answer");
assert.equal(dense.volatilityPct, 0, "a flat series has no volatility");

// A step change only inside the last week must move avg7d and barely move avg90d.
// Index 83 is the newest-but-seventh point, so the last 7 days are all 2_000.
const stepped = dailySeries(90, (i) => (i >= 83 ? 2_000 : 1_000));
const step = calculateTechnicalIndicators(stepped);
assert.equal(step.avg7d, 2_000, "the 7-day window must contain only the last 7 days");
assert.ok(step.avg90d !== null && step.avg90d < 1_100, "the 90-day window must dilute the step");
assert.equal(step.smaCrossover, "bullish", "7d above 30d is bullish");

// ── 3. Support sits below price and resistance above, or neither is reported ────
// The screenshot showed support 20.71M against a price of 17.05M, because the window spanned
// the item's whole life. Over a real 30-day window the deciles must bracket recent trade.
// Cycles low/high/mid and ends on mid, so the last price provably sits between the deciles
// and both are real levels. The 30-day window holds ten of each value.
const drifting = dailySeries(90, (i) => [1_000, 1_100, 1_050][i % 3]);
const drift = calculateTechnicalIndicators(drifting);
const lastPrice = drifting[drifting.length - 1].price;
assert.ok(drift.support !== null && drift.resistance !== null, "90 daily points is plenty");
assert.ok(drift.support! <= lastPrice, `support ${drift.support} must not sit above price ${lastPrice}`);
assert.ok(drift.resistance! >= lastPrice, `resistance ${drift.resistance} must not sit below price`);
assert.ok(
  drift.resistance! < lastPrice * 2,
  "resistance drawn from 30 days cannot be a multiple of the current price",
);

// At a 30-day high there is no level above price, and saying so beats inventing one. This is
// the guard that retires the screenshot's "support 20.71M" against a price of 17.05M.
const atHigh = calculateTechnicalIndicators(dailySeries(90, (i) => 1_000 + i * 10));
assert.equal(atHigh.resistance, null, "no resistance above a price sitting at its 30-day high");
assert.ok(atHigh.support !== null && atHigh.support <= atHigh.avg30d!, "support still reads below");

// ── 4. Observable ranges span time too ──────────────────────────────────────────
const r7 = calculateObservableRange(stepped, 7);
assert.ok(r7 !== null);
assert.equal(r7!.low, 2_000, "the 7-day range must only see the last 7 days");
assert.equal(r7!.high, 2_000);
const r30 = calculateObservableRange(stepped, 30);
assert.equal(r30!.low, 1_000, "the 30-day range reaches back before the step");
assert.equal(r30!.high, 2_000);
assert.equal(
  calculateObservableRange(monthlyish, 7),
  null,
  "a 7-day range over monthly samples is not a range",
);

// ── 5. The primitives ───────────────────────────────────────────────────────────
assert.equal(pricesWithinDays(stepped, 7).length, 7, "one point per day, seven days");
assert.equal(pricesWithinDays(stepped, 0).length, 0, "a zero-day window is empty, not everything");
assert.equal(calculateVolatility([]), null);
assert.equal(calculateVolatility([1, 2]), null, "two points is below the volatility floor");
assert.equal(calculateVolatility([5, 5, 5, 5]), 0);
assert.deepEqual(findSupportResistance([1, 2, 3]), { support: null, resistance: null });

console.log(
  "ok — indicators: windows are days not samples (12 monthly points yield nulls, not a " +
    "7-month average), thin windows report null rather than 0, support stays below price",
);
