/**
 * Offline check for shared/chartWindow.ts. Run: npx tsx scripts/check-chart-window.ts
 *
 * The first case is the regression that shipped: a trade far outside the visible window
 * dragged the y-axis out to meet it.
 */
import assert from "node:assert/strict";
import { chartWindow } from "../shared/chartWindow";

const HOUR = 60 * 60 * 1000;
const t0 = 1_770_000_000_000;

/** 24 hourly points wandering between 85,000 and 97,000 — the shape from the screenshot. */
const day = Array.from({ length: 24 }, (_, i) => ({
  timestamp: t0 + i * HOUR,
  price: 85_000 + i * 500,
}));

// --- the regression -----------------------------------------------------------------------
{
  // A trade six months back at 200,000, when the visible day trades at 85k–96.5k.
  const stale = [{ timestamp: t0 - 180 * 24 * HOUR, price: 200_000 }];
  const w = chartWindow(day, stale, null)!;

  assert.equal(w.visibleTrades.length, 0, "a trade outside the window is not plotted");
  assert.equal(w.hiddenTradeCount, 1, "and it is counted, not silently dropped");
  assert.ok(
    w.yMax < 100_000,
    `an out-of-window trade must not inflate the y-axis — got yMax ${w.yMax}`,
  );
  // The whole visible series still fits, with room above and below.
  assert.ok(w.yMin < 85_000 && w.yMax > 96_500);
}

// --- an in-window trade DOES belong in the domain -------------------------------------------
{
  const inside = [{ timestamp: t0 + 5 * HOUR, price: 120_000 }];
  const w = chartWindow(day, inside, null)!;
  assert.equal(w.visibleTrades.length, 1);
  assert.equal(w.hiddenTradeCount, 0);
  assert.ok(w.yMax > 120_000, "a trade you made in this window is part of this window");
}

// --- window bounds are inclusive ------------------------------------------------------------
{
  const edges = [
    { timestamp: day[0].timestamp, price: 90_000 },
    { timestamp: day[day.length - 1].timestamp, price: 90_000 },
    { timestamp: day[0].timestamp - 1, price: 90_000 },
    { timestamp: day[day.length - 1].timestamp + 1, price: 90_000 },
  ];
  const w = chartWindow(day, edges, null)!;
  assert.equal(w.visibleTrades.length, 2, "a trade exactly on either edge is inside");
  assert.equal(w.hiddenTradeCount, 2, "one millisecond past either edge is outside");
}

// --- zooming narrows the window, and the trade set with it ----------------------------------
{
  const mid = [{ timestamp: t0 + 12 * HOUR, price: 91_000 }];
  const full = chartWindow(day, mid, null)!;
  assert.equal(full.isZoomed, false);
  assert.equal(full.visible.length, 24);
  assert.equal(full.visibleTrades.length, 1);

  const zoomed = chartWindow(day, mid, { start: 0, end: 5 })!;
  assert.equal(zoomed.isZoomed, true);
  assert.equal(zoomed.visible.length, 6);
  assert.equal(zoomed.windowEnd, t0 + 5 * HOUR);
  assert.equal(zoomed.visibleTrades.length, 0, "the trade is no longer in the zoomed window");
  assert.equal(zoomed.hiddenTradeCount, 1);
  // The y-axis tightens to the slice rather than staying on the full day.
  assert.ok(zoomed.yMax < full.yMax, "zooming in rescales the price axis");
}

// --- stale indices from a timeframe switch are clamped, never thrown -------------------------
{
  const short = day.slice(0, 3);
  const w = chartWindow(short, [], { start: 40, end: 90 })!;
  assert.equal(w.startIndex, 2, "a start past the end clamps to the last index");
  assert.equal(w.endIndex, 2);
  assert.equal(w.visible.length, 1, "and still yields a drawable window");

  const inverted = chartWindow(day, [], { start: 10, end: 3 })!;
  assert.equal(inverted.endIndex, 10, "an inverted range collapses to a point, not a crash");
  assert.equal(inverted.visible.length, 1);

  const negative = chartWindow(day, [], { start: -5, end: 2 })!;
  assert.equal(negative.startIndex, 0);
}

// --- degenerate series still produce a usable axis --------------------------------------------
{
  assert.equal(chartWindow([], [], null), null, "no points means no window");

  const flat = chartWindow([{ timestamp: t0, price: 5_000 }], [], null)!;
  assert.ok(flat.yMin < flat.yMax, "a single point still needs a non-empty axis");
  assert.ok(flat.yMin < 5_000 && flat.yMax > 5_000);

  const zeroes = chartWindow(
    [{ timestamp: t0, price: 0 }, { timestamp: t0 + HOUR, price: 0 }],
    [],
    null,
  )!;
  assert.ok(zeroes.yMin < zeroes.yMax, "an all-zero series must not collapse the axis");
}

console.log(
  "ok — chart window: out-of-window trades excluded from the y-axis and counted, edges " +
    "inclusive, zoom rescales, stale/inverted indices clamp, flat and zero series keep an axis",
);
