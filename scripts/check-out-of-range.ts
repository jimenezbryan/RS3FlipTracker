/**
 * Self-check for the out-of-range alert's pure parts.
 * Run: npx tsx scripts/check-out-of-range.ts
 * Offline, assert-based, no framework.
 *
 * What would fail silently in production: a spike alert on an item with no real baseline, a
 * spike that has already reverted still posting, a null side (no trades) throwing, and the
 * cooldown either never suppressing or suppressing forever.
 */
import assert from "node:assert/strict";
import {
  detectOutOfRange, screenCandidates, isCoolingDown, MIN_BASELINE_POINTS, COOLDOWN_MS,
  type DailyPoint, type HourlyPoint,
} from "../shared/outOfRange";

const H = 3_600_000;
const D = 24 * H;
const now = Date.UTC(2026, 9, 18, 12, 0, 0);

/** n daily points ending just before the last-24h cutoff, all at `price`. */
const flatDaily = (n: number, price: number): DailyPoint[] =>
  Array.from({ length: n }, (_, i) => ({ t: now - 25 * H - (n - 1 - i) * D, price }));
/** 24 hourly points at `high`/`low`, newest last. */
const flatHourly = (high: number | null, low: number | null): HourlyPoint[] =>
  Array.from({ length: 24 }, (_, i) => ({ t: now - (23 - i) * H, high, low }));

// ── 1. detectOutOfRange ───────────────────────────────────────────────────────────
// Decimation-like: normal 40m..50m, trades at 100m now.
const daily = [...flatDaily(15, 40_000_000), ...flatDaily(15, 50_000_000).map((p) => ({ ...p, t: p.t - 20 * D }))];
const spikeHourly = flatHourly(100_000_000, 95_000_000);
const spike = detectOutOfRange(spikeHourly, daily, { high: 100_000_000, low: 95_000_000 }, now);
assert.ok(spike, "100m over a 50m high is a spike");
assert.equal(spike!.direction, "spike");
assert.equal(spike!.normalHigh, 50_000_000);
assert.equal(Math.round(spike!.pctBeyond), 100);
assert.equal(spike!.avg1h, 97_500_000, "1h = mid of newest point");

// Reverted: the 24h window still contains the spike but the latest price is back to normal.
const reverted = detectOutOfRange(spikeHourly, daily, { high: 48_000_000, low: 47_000_000 }, now);
assert.equal(reverted, null, "reverted spike must not alert");

// Inside the 1.25x band: 55m against a 50m high is not enough.
assert.equal(detectOutOfRange(flatHourly(55_000_000, 54_000_000), daily, { high: 55_000_000, low: 54_000_000 }, now), null, "1.1x is not out of range");

// Dump: normal low 40m, trades at 25m (0.625x, under 0.80x).
const dump = detectOutOfRange(flatHourly(30_000_000, 25_000_000), daily, { high: 30_000_000, low: 25_000_000 }, now);
assert.equal(dump?.direction, "dump");
assert.equal(dump?.normalLow, 40_000_000);

// Thin baseline: one fewer point than the minimum never alerts.
assert.equal(
  detectOutOfRange(spikeHourly, flatDaily(MIN_BASELINE_POINTS - 1, 50_000_000), { high: 100_000_000, low: 95_000_000 }, now),
  null, "thin baseline",
);
assert.ok(
  detectOutOfRange(spikeHourly, flatDaily(MIN_BASELINE_POINTS, 50_000_000), { high: 100_000_000, low: 95_000_000 }, now),
  "exactly the minimum is enough",
);

// Baseline excludes the last 24h: a daily point inside the window must not raise the normal high.
const polluted = [...flatDaily(10, 50_000_000), { t: now - 2 * H, price: 100_000_000 }];
assert.equal(detectOutOfRange(spikeHourly, polluted, { high: 100_000_000, low: 95_000_000 }, now)?.normalHigh, 50_000_000, "last 24h excluded from baseline");

// One-sided trading: null sides neither throw nor invent a dump.
const oneSided = detectOutOfRange(flatHourly(100_000_000, null), daily, { high: 100_000_000, low: null }, now);
assert.equal(oneSided?.direction, "spike");
assert.equal(oneSided?.avg1h, 100_000_000, "mid falls back to the side that traded");
assert.equal(detectOutOfRange(flatHourly(null, null), daily, { high: null, low: null }, now), null, "no trades, no alert");
assert.equal(detectOutOfRange([], daily, { high: 100_000_000, low: 95_000_000 }, now), null, "no hourly data");

// ── 2. screenCandidates ───────────────────────────────────────────────────────────
const item = (id: number, over: Partial<Parameters<typeof screenCandidates>[0][number]> = {}) =>
  ({ id, geLimit: 10, volume: 50, hourVolume: 3, buyPrice: 1000, sellPrice: 1000, ...over });
const anchors = { "1": { d1: 1000, d7: 1000 }, "2": { d1: 1000, d7: 1000 }, "3": { d1: 1000, d7: 1000 }, "4": { d1: null, d7: null }, "5": { d1: 1000, d7: 1000 } };
const ids = screenCandidates(
  [
    item(1, { sellPrice: 1300 }),                  // +30% -> spike candidate
    item(2, { buyPrice: 700 }),                    // -30% -> dump candidate
    item(3, { sellPrice: 1300, volume: 5 }),       // moved but under geLimit -> illiquid
    item(4, { sellPrice: 1300 }),                  // no anchors -> cannot screen
    item(5, { sellPrice: 1300, hourVolume: 0 }),   // nothing traded this hour
  ],
  anchors,
);
assert.deepEqual([...ids].sort(), [1, 2], "only liquid movers with anchors survive");
const many = Array.from({ length: 30 }, (_, i) => item(i + 100, { sellPrice: 1200 + i * 10 }));
const manyAnchors = Object.fromEntries(many.map((m) => [String(m.id), { d1: 1000, d7: 1000 }]));
const top = screenCandidates(many, manyAnchors);
assert.equal(top.length, 20, "capped at MAX_CANDIDATES");
assert.equal(top[0], 129, "strongest move first");

// ── 3. isCoolingDown ──────────────────────────────────────────────────────────────
const row = { itemId: 1, direction: "spike" as const, lastAlertAt: new Date(now - 2 * H), lastPrice: 100_000_000 };
assert.equal(isCoolingDown(undefined, "spike", 1, now), false, "never alerted");
assert.equal(isCoolingDown(row, "spike", 100_000_000, now), true, "2h in, same price");
assert.equal(isCoolingDown(row, "spike", 105_000_000, now), true, "+5% is not a breakout");
assert.equal(isCoolingDown(row, "spike", 110_000_000, now), false, "+10% further breaks the cooldown");
assert.equal(isCoolingDown(row, "spike", 90_000_000, now), true, "a smaller price is not a further spike");
assert.equal(isCoolingDown({ ...row, lastAlertAt: new Date(now - COOLDOWN_MS) }, "spike", 100_000_000, now), false, "cooldown elapsed");
const dumpRow = { ...row, direction: "dump" as const, lastPrice: 1000 };
assert.equal(isCoolingDown(dumpRow, "dump", 900, now), false, "-10% further breaks a dump cooldown");
assert.equal(isCoolingDown(dumpRow, "dump", 950, now), true, "-5% does not");

// ── 4. embed + chart ──────────────────────────────────────────────────────────────
import { buildOutOfRangeEmbed, chartUrl } from "../shared/outOfRangeEmbed";

const week: HourlyPoint[] = Array.from({ length: 168 }, (_, i) => ({ t: now - (167 - i) * H, high: 50_000_000 + i * 300_000, low: 48_000_000 }));
const url = chartUrl(week, 40_000_000, 50_000_000, now);
assert.ok(url && url.startsWith("https://quickchart.io/chart?"), "chart url");
assert.ok(url!.length < 2000, `chart url must stay short, was ${url!.length}`);
assert.equal(chartUrl([], 1, 2, now), null, "no series, no chart");

const embed = buildOutOfRangeEmbed({
  itemId: 11694, name: "Decimation", icon: "https://example.test/i.gif", geLimit: 8, volume: 2268, margin: 1_251_561,
  detection: spike!, latest: { high: 100_000_000, highTime: Math.floor(now / 1000) - 35 * 60, low: 95_000_000, lowTime: Math.floor(now / 1000) - 35 * 60 },
  series7d: week,
}, now);
assert.match(embed.title, /^Spike on Decimation/);
assert.equal(embed.color, 0x22c55e, "spike is green: a price to sell into");
assert.equal(embed.thumbnail?.url, "https://example.test/i.gif");
assert.ok(embed.image?.url.startsWith("https://quickchart.io/"), "chart attached");
assert.match(embed.description, /Volume.*2,268.*Limit.*8/);
assert.match(embed.description, /<t:\d+:R>/, "relative timestamps for insta buy/sell");
assert.match(embed.footer.text, /RuneScape Wiki/, "footer names the price source");
assert.match(embed.footer.text, /Weird Gloop/, "footer names the Normal range source");
assert.equal(
  buildOutOfRangeEmbed({ ...{ itemId: 1, name: "X", icon: "i", geLimit: 1, volume: 1, margin: 1, detection: dump!, latest: { high: null, highTime: null, low: 25_000_000, lowTime: null }, series7d: [] } }, now).image,
  undefined, "no series means no image, and null times must not crash",
);
assert.equal(
  buildOutOfRangeEmbed({ itemId: 1, name: "X", icon: "i", geLimit: 1, volume: 1, margin: 1, detection: dump!, latest: { high: null, highTime: null, low: 25_000_000, lowTime: null }, series7d: [] }, now).color,
  0xef4444, "dump is red",
);

console.log("check-out-of-range: ok");
