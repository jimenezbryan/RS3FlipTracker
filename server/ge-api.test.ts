import { test } from "node:test";
import assert from "node:assert/strict";
import { getItemTrend } from "./ge-api";

const ITEM = 1;

// WeirdGloop's /last90d shape: one daily point per day, oldest first.
function history(prices: number[]) {
  const start = Date.UTC(2026, 9, 1);
  return { [ITEM]: prices.map((price, i) => ({ timestamp: new Date(start + i * 86_400_000).toISOString(), price })) };
}

function trendFor(t: { mock: any }, prices: number[]) {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(history(prices))));
  return getItemTrend(ITEM);
}

// A week ago at 1,000 gp, today at `now`.
const week = (now: number) => [1000, 1000, 1000, 1000, 1000, 1000, 1000, now];

for (const [now, direction] of [
  [1021, "rising"],
  [1020, "stable"],
  [980, "stable"],
  [979, "falling"],
] as const) {
  test(`7-day move to ${now} gp reads as ${direction}`, async (t) => {
    const trend = await trendFor(t, week(now));
    assert.equal(trend?.direction, direction);
    assert.equal(trend?.changeAmount, now - 1000);
    assert.equal(trend?.changePercent, (now - 1000) / 10);
  });
}

test("a two-day bounce inside a 7-day drop reads as falling, not rising", async (t) => {
  // The original report: a green "rising" arrow next to -4.7%.
  const trend = await trendFor(t, [1000, 1000, 1000, 1000, 1000, 900, 930, 953]);
  assert.equal(trend?.direction, "falling");
  assert.equal(trend?.changePercent, -4.7);
  assert.equal(trend?.changeAmount, -47);
});

test("the result carries no streak count", async (t) => {
  const trend = await trendFor(t, week(1050));
  assert.ok(trend);
  assert.ok(!("trendDays" in trend));
});

test("falling over 7 days near the 30-day low is hold, quoting the 7-day drop", async (t) => {
  // Near the 30-day low would be a buy if it weren't falling.
  const trend = await trendFor(t, [...Array(20).fill(1200), ...week(953)]);
  assert.equal(trend?.direction, "falling");
  assert.equal(trend?.recommendation, "hold");
  assert.equal(trend?.recommendationReason, "Down 4.7% over 7 days. Wait for stabilization.");
});

test("rising over 7 days at the 30-day high and near average is buy, quoting the 7-day rise", async (t) => {
  // At the 30-day high would be a sell if it weren't rising.
  const trend = await trendFor(t, [900, ...Array(20).fill(1000), ...week(1031)]);
  assert.equal(trend?.direction, "rising");
  assert.equal(trend?.recommendation, "buy");
  assert.equal(trend?.recommendationReason, "Up 3.1% over 7 days, still near average.");
});

test("stable near the 30-day low is still a buy", async (t) => {
  const trend = await trendFor(t, [...Array(20).fill(1200), ...week(1010)]);
  assert.equal(trend?.direction, "stable");
  assert.equal(trend?.recommendation, "buy");
  assert.match(trend!.recommendationReason, /^Near 30-day low/);
});

test("stable near the 30-day high is still a sell", async (t) => {
  const trend = await trendFor(t, [...Array(20).fill(800), ...week(990)]);
  assert.equal(trend?.direction, "stable");
  assert.equal(trend?.recommendation, "sell");
  assert.match(trend!.recommendationReason, /^Near 30-day high/);
});

test("fewer than 8 days of history measures from the oldest price", async (t) => {
  const trend = await trendFor(t, [1000, 1020, 1050]);
  assert.equal(trend?.direction, "rising");
  assert.equal(trend?.changePercent, 5);
  assert.equal(trend?.changeAmount, 50);
});

test("no history means no trend", async (t) => {
  assert.equal(await trendFor(t, []), null);
});

test("a failed fetch means no trend", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  assert.equal(await getItemTrend(ITEM), null);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  assert.equal(await getItemTrend(ITEM), null);
});
