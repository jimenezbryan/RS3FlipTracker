/**
 * Self-check for the Scanner alert runner's pure parts.
 * Run: npx tsx scripts/check-scanner-alerts.ts
 * Offline, assert-based, no framework.
 *
 * Three things that would fail silently in production if they broke: the "due" rule (an alert
 * that never fires, or fires every tick), the 'new' diff (an alert that repeats the same items
 * every run), and the preset pipeline reproducing the Scanner's order (a Discord message that
 * lists different items than the page would).
 */
import assert from "node:assert/strict";
import { isDue, pickItems, runPreset, scoreItems, type PresetFilters, type ScannerItem } from "../shared/scannerPipeline";
import { EMPTY_SELECTION } from "../shared/scannerFilters";

// ── 1. isDue ──────────────────────────────────────────────────────────────────────
const now = new Date("2026-10-13T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

assert.equal(isDue({ alertEnabled: false, lastRunAt: null, intervalMinutes: 15 }, now), false, "disabled never due");
assert.equal(isDue({ alertEnabled: true, lastRunAt: null, intervalMinutes: 15 }, now), true, "never run is due");
assert.equal(isDue({ alertEnabled: true, lastRunAt: ago(10), intervalMinutes: 60 }, now), false, "10 min into a 60 min interval");
assert.equal(isDue({ alertEnabled: true, lastRunAt: ago(60), intervalMinutes: 60 }, now), true, "exactly on the interval");
// The slack: a tick that lands 30s early must not push a 60-minute alert to the next tick.
assert.equal(isDue({ alertEnabled: true, lastRunAt: ago(59.5), intervalMinutes: 60 }, now), true, "within 1 min slack");
assert.equal(isDue({ alertEnabled: true, lastRunAt: ago(58), intervalMinutes: 60 }, now), false, "outside the slack");

// ── 2. pickItems ──────────────────────────────────────────────────────────────────
const base: ScannerItem = {
  id: 0, name: "x", icon: "", isMembers: false, geLimit: 100, buyPrice: 1000, sellPrice: 1100,
  margin: 100, volume: 500, hourVolume: 10, fillQty: 50, potentialProfit: 5000, marginVolume: 0,
  roi: 8, netProfit: 4000, capitalEfficiency: 4, trend: "stable", changePct24h: 0,
  category: "Misc", volatility: "low", suggestedBuyPrice: 1000, suggestedSellPrice: 1100,
  suggestedMarginPct: 10, priceTier: "low", confidence: "medium", range7dLow: null,
  range7dHigh: null, range7dSpreadPct: null,
};
const mk = (over: Partial<ScannerItem>): ScannerItem => ({ ...base, ...over });
const scored = scoreItems([mk({ id: 1, netProfit: 300 }), mk({ id: 2, netProfit: 200 }), mk({ id: 3, netProfit: 100 })]);

assert.equal(pickItems({ mode: "new", topN: 10, lastItemIds: null }, scored), null, "first 'new' run is baseline only");
assert.deepEqual(
  pickItems({ mode: "new", topN: 10, lastItemIds: null }, scored, { force: true })?.items.map((i) => i.id),
  [1, 2, 3],
  "forced first run sends everything",
);
assert.deepEqual(
  pickItems({ mode: "new", topN: 10, lastItemIds: [1, 3] }, scored)?.items.map((i) => i.id),
  [2],
  "'new' sends only ids not in the last run",
);
assert.equal(pickItems({ mode: "new", topN: 10, lastItemIds: [1, 2, 3] }, scored), null, "'new' with nothing new is silent");
const capped = pickItems({ mode: "new", topN: 2, lastItemIds: [] }, scored);
assert.deepEqual(capped?.items.map((i) => i.id), [1, 2], "'new' caps at topN");
assert.equal(capped?.total, 3, "…but reports the uncapped count");
assert.deepEqual(pickItems({ mode: "summary", topN: 2, lastItemIds: [1, 2, 3] }, scored)?.items.map((i) => i.id), [1, 2], "summary ignores lastItemIds");
assert.equal(pickItems({ mode: "summary", topN: 2, lastItemIds: null }, []), null, "summary with no matches is silent");

// ── 3. runPreset reproduces the Scanner's order ───────────────────────────────────
const filters: PresetFilters = {
  searchQuery: "", f2pOnly: false, watchlistOnly: false, signalsOnly: false,
  showUnprofitable: false, highScoreOnly: false,
  selection: EMPTY_SELECTION, columnFilters: {}, sortKey: "trend", sortDirection: "asc",
};
const items = [
  mk({ id: 1, trend: "up", netProfit: 50 }),
  mk({ id: 2, trend: "down", netProfit: 10 }),
  mk({ id: 3, trend: "down", netProfit: 90 }),
  mk({ id: 4, trend: "up", netProfit: -5 }),   // hidden: unprofitable by default
  mk({ id: 5, trend: "stable", netProfit: 20 }),
];
// trend asc → down, stable, up; ties on a bucket column fall back to netProfit desc.
assert.deepEqual(runPreset(items, filters).map((i) => i.id), [3, 2, 5, 1], "bucket sort with netProfit tie-break, unprofitable hidden");
assert.deepEqual(
  runPreset(items, { ...filters, showUnprofitable: true, sortKey: "netProfit", sortDirection: "desc" }).map((i) => i.id),
  [3, 1, 5, 2, 4],
  "default sort, unprofitable shown",
);
assert.deepEqual(
  runPreset(items, { ...filters, watchlistOnly: true }, new Set([2, 5])).map((i) => i.id),
  [2, 5],
  "watchlistOnly reads the favourite set the server passes in",
);
assert.deepEqual(
  runPreset(items, { ...filters, columnFilters: { netProfit: { kind: "range", min: 40, max: null } } }).map((i) => i.id),
  [3, 1],
  "column filters apply",
);

console.log("check-scanner-alerts: all assertions passed");
