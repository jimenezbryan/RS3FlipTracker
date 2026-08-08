/**
 * Self-check for the chart's zone and moving-average maths.
 * Run: npx tsx scripts/check-price-zones.ts
 *
 * ponytail: assert-based, fixtures inline, no network and no framework. Unlike
 * check-ge-api.ts this one is offline, so it is safe to run in a hook or CI.
 *
 * This exists because the Scanner's signal scoring lives in a React useMemo and cannot be
 * tested at all — a gap two project logs have now recorded. Zone logic went to shared/
 * specifically so it would not repeat that.
 */
import assert from "node:assert/strict";
import {
  calculatePriceZones,
  movingAverage,
  quantile,
  BUY_QUANTILE,
  SELL_QUANTILE,
  type ZonePoint,
} from "../shared/priceZones";

const flat = (price: number, n: number, volume: number): ZonePoint[] =>
  Array.from({ length: n }, () => ({ price, volume }));

// ── 1. Direction ────────────────────────────────────────────────────────────────
// A series that ends at its high must read "sell"; one that ends at its low, "buy".
const rising: ZonePoint[] = [100, 110, 120, 130, 140, 150, 160, 170].map((price) => ({ price }));
const falling = [...rising].reverse();

assert.equal(calculatePriceZones(rising)!.zone, "sell", "rising series should end in the sell zone");
assert.equal(calculatePriceZones(falling)!.zone, "buy", "falling series should end in the buy zone");

// ── 2. Accumulation needs BOTH the middle band and elevated volume ──────────────
// Same prices, only the volume profile differs. This is the assertion that stops
// "Accumulation" quietly degrading into "anything mid-range", which is exactly how the old
// Scanner signals ended up firing on 93% of items.
const midPrices = [100, 140, 90, 150, 130, 95, 145, 125];
const quietVolume: ZonePoint[] = midPrices.map((price) => ({ price, volume: 1000 }));
const risingVolume: ZonePoint[] = midPrices.map((price, i) => ({
  price,
  volume: i >= midPrices.length * 0.75 ? 5000 : 1000,
}));

const quiet = calculatePriceZones(quietVolume)!;
const busy = calculatePriceZones(risingVolume)!;
assert.equal(quiet.zone, "neutral", "flat volume in the middle band is neutral, not accumulation");
assert.equal(quiet.accumulating, false, "flat volume must not count as accumulating");
assert.equal(busy.zone, "accumulation", "elevated recent volume in the middle band is accumulation");
assert.ok(busy.recentVolume! > busy.baseVolume!, "recent volume should exceed the window baseline");

// A series with no volume at all can never claim accumulation — it has no evidence.
const noVolume = calculatePriceZones(midPrices.map((price) => ({ price })))!;
assert.equal(noVolume.accumulating, false, "a series without volume cannot be accumulating");
assert.equal(noVolume.recentVolume, null, "recentVolume should be null when volume is absent");

// ── 3. Band ordering and containment ────────────────────────────────────────────
// The bands are drawn as stacked ReferenceAreas; if these ever cross, the chart renders
// an inverted region rather than throwing.
for (const [name, series] of Object.entries({ rising, falling, quietVolume, risingVolume })) {
  const z = calculatePriceZones(series)!;
  assert.ok(z.buyMax < z.sellMin, `buyMax must sit below sellMin on ${name}`);
  assert.ok(z.low <= z.buyMax, `buyMax must sit inside the range on ${name}`);
  assert.ok(z.sellMin <= z.high, `sellMin must sit inside the range on ${name}`);
  assert.ok(z.current >= z.low && z.current <= z.high, `current must sit inside the range on ${name}`);
}

// ── 4. A spike must not drag the bands ──────────────────────────────────────────
// The reason for quantiles over position-in-min-max-range. One mis-clicked trade at 10x
// should barely move the cut; a range-based cut moves by most of the spike.
const calm = Array.from({ length: 20 }, (_, i) => ({ price: 100 + (i % 5) }));
const spiked = [...calm.slice(0, 19), { price: 1000 }];
const calmZ = calculatePriceZones(calm)!;
const spikedZ = calculatePriceZones(spiked)!;

const quantileShift = Math.abs(spikedZ.sellMin - calmZ.sellMin);
const rangeCutCalm = calmZ.low + (calmZ.high - calmZ.low) * SELL_QUANTILE;
const rangeCutSpiked = 100 + (1000 - 100) * SELL_QUANTILE;
const rangeShift = Math.abs(rangeCutSpiked - rangeCutCalm);
assert.ok(
  quantileShift < rangeShift / 10,
  `a 10x spike moved the quantile cut by ${quantileShift} but would move a range cut by ${rangeShift}`,
);

// ── 5. Quantile arithmetic ──────────────────────────────────────────────────────
assert.equal(quantile([10, 20, 30, 40, 50], 0.5), 30, "median of a 5-element series");
assert.equal(quantile([10, 20, 30, 40], 0.5), 25, "median interpolates between the middle pair");
assert.equal(quantile([10, 20, 30, 40, 50], 0), 10, "q=0 is the minimum");
assert.equal(quantile([10, 20, 30, 40, 50], 1), 50, "q=1 is the maximum");
assert.equal(quantile([42], 0.25), 42, "a single value is every quantile");
assert.ok(BUY_QUANTILE < SELL_QUANTILE, "buy quantile must sit below the sell quantile");

// ── 6. Degenerate input returns null, not a fake band ───────────────────────────
// The chart must be able to say "not enough data" rather than draw three bands off three
// points. Fabricating a band from nothing is the exact failure this project keeps hitting.
assert.equal(calculatePriceZones([]), null, "empty series must return null");
assert.equal(calculatePriceZones(flat(100, 3, 1)), null, "3 points is not enough for quartiles");
assert.ok(calculatePriceZones(flat(100, 4, 1)) !== null, "4 points is enough");
assert.equal(
  calculatePriceZones([{ price: 0 }, { price: -5 }, { price: NaN }, { price: 100 }]),
  null,
  "non-positive and non-finite prices must be discarded, leaving too few to band",
);

// A perfectly flat series is degenerate but real (a fixed-price item). It must not crash,
// and with buyMax === sellMin the current price reads as "buy" rather than throwing.
const flatZ = calculatePriceZones(flat(100, 10, 1))!;
assert.equal(flatZ.buyMax, 100);
assert.equal(flatZ.sellMin, 100);
assert.equal(flatZ.zone, "buy", "a flat series should not produce an undefined zone");

// ── 7. Moving average ───────────────────────────────────────────────────────────
const ma3 = movingAverage([10, 20, 30, 40, 50], 3);
assert.deepEqual(ma3, [null, null, 20, 30, 40], "3-period SMA is wrong");
assert.equal(
  ma3.filter((v) => v === null).length,
  2,
  "an n-period SMA must lead with exactly n-1 nulls",
);
assert.deepEqual(movingAverage([5, 5, 5], 1), [5, 5, 5], "1-period SMA is the series itself");
assert.deepEqual(movingAverage([1, 2], 5), [null, null], "period longer than the series is all null");
assert.deepEqual(movingAverage([], 3), [], "empty input gives empty output");
// Rounded to whole gp, like every other price in this codebase.
assert.deepEqual(movingAverage([1, 2], 2), [null, 2], "SMA must round to whole gp (1.5 -> 2)");

console.log(
  `ok — zones: rising=sell falling=buy, accumulation gated on volume ` +
    `(quiet=${quiet.zone} busy=${busy.zone}), spike moved the cut ${quantileShift.toFixed(1)}gp ` +
    `vs ${rangeShift.toFixed(1)}gp for a range cut`,
);
