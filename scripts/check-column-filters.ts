/**
 * Offline check for shared/columnFilters.ts. Run: npx tsx scripts/check-column-filters.ts
 *
 * assert-based, no framework — same shape as check-scanner-filters.ts.
 */
import assert from "node:assert/strict";
import {
  activeColumnCount,
  cellOptions,
  columnExtent,
  columnOptions,
  describeColumnFilter,
  isNoOp,
  matchesColumnFilters,
  setColumnFilter,
  type ColumnFilters,
  type FilterableRow,
} from "../shared/columnFilters";

const rows: FilterableRow[] = [
  { name: "Abyssal whip", roi: 8.7, volume: 41109, trend: "up", isMembers: true, signals: ["Strong Trend"], changePct24h: 13.7 },
  { name: "Elder frame", roi: 30.2, volume: 900, trend: "down", isMembers: true, signals: ["Deep Value", "Pullback"], changePct24h: null },
  { name: "Bronze bar", roi: 1.2, volume: 250000, trend: "stable", isMembers: false, signals: [], changePct24h: 0 },
  { name: "Rune bar", roi: 15.0, volume: 12000, trend: "up", isMembers: false, signals: ["Good Value"], changePct24h: -4.2 },
];

const all = (f: ColumnFilters) => rows.filter((r) => matchesColumnFilters(r, f)).map((r) => r.name);

// --- no-op filters constrain nothing ------------------------------------------------------
assert.ok(isNoOp(undefined));
assert.ok(isNoOp({ kind: "range", min: null, max: null }));
assert.ok(isNoOp({ kind: "set", values: [] }));
assert.ok(isNoOp({ kind: "text", query: "   " }));
assert.equal(all({ roi: { kind: "range", min: null, max: null } }).length, 4, "an empty range is not a filter");

// --- range ---------------------------------------------------------------------------------
assert.deepEqual(all({ roi: { kind: "range", min: 10, max: null } }), ["Elder frame", "Rune bar"]);
assert.deepEqual(all({ roi: { kind: "range", min: null, max: 8.7 } }), ["Abyssal whip", "Bronze bar"]);
assert.deepEqual(all({ roi: { kind: "range", min: 8, max: 16 } }), ["Abyssal whip", "Rune bar"]);
// Bounds are inclusive on both ends, so a value sitting exactly on one is inside.
assert.deepEqual(all({ roi: { kind: "range", min: 8.7, max: 8.7 } }), ["Abyssal whip"]);

// A null cell is absent, not zero. Bronze bar's 0 matches "<= 0"; Elder frame's null does not.
assert.deepEqual(
  all({ changePct24h: { kind: "range", min: null, max: 0 } }),
  ["Bronze bar", "Rune bar"],
  "null is absent, not zero — it cannot satisfy a bound",
);

// --- set -----------------------------------------------------------------------------------
assert.deepEqual(all({ trend: { kind: "set", values: ["up"] } }), ["Abyssal whip", "Rune bar"]);
assert.deepEqual(all({ trend: { kind: "set", values: ["up", "stable"] } }), ["Abyssal whip", "Bronze bar", "Rune bar"]);
assert.deepEqual(all({ isMembers: { kind: "set", values: ["false"] } }), ["Bronze bar", "Rune bar"]);

// An array cell matches when ANY of its entries is selected.
assert.deepEqual(all({ signals: { kind: "set", values: ["Pullback"] } }), ["Elder frame"]);
assert.deepEqual(
  all({ signals: { kind: "set", values: ["Deep Value", "Good Value"] } }),
  ["Elder frame", "Rune bar"],
);
// An empty array offers nothing to match, so it is excluded rather than matching everything.
assert.ok(!all({ signals: { kind: "set", values: ["Deep Value"] } }).includes("Bronze bar"));
assert.deepEqual(cellOptions([]), [], "no signals means no options");

// --- text ----------------------------------------------------------------------------------
assert.deepEqual(all({ name: { kind: "text", query: "bar" } }), ["Bronze bar", "Rune bar"]);
assert.deepEqual(all({ name: { kind: "text", query: "WHIP" } }), ["Abyssal whip"], "case-insensitive");

// --- filters compose by intersection ---------------------------------------------------------
assert.deepEqual(
  all({ trend: { kind: "set", values: ["up"] }, roi: { kind: "range", min: 10, max: null } }),
  ["Rune bar"],
);

// --- faceting: counts exclude the column's OWN filter -----------------------------------------
const trendUp: ColumnFilters = { trend: { kind: "set", values: ["up"] } };
assert.deepEqual(
  columnOptions(rows, "trend", trendUp),
  [
    { value: "up", count: 2 },
    { value: "down", count: 1 },
    { value: "stable", count: 1 },
  ],
  "trend's own filter must not collapse its own counts",
);
// ...but it DOES narrow every other column.
assert.deepEqual(
  columnOptions(rows, "isMembers", trendUp),
  [
    { value: "false", count: 1 },
    { value: "true", count: 1 },
  ],
  "other columns are counted with trend applied",
);
// Array cells contribute to each of their values.
assert.deepEqual(columnOptions(rows, "signals", {}), [
  { value: "Deep Value", count: 1 },
  { value: "Good Value", count: 1 },
  { value: "Pullback", count: 1 },
  { value: "Strong Trend", count: 1 },
]);

// --- extents follow the other filters too -------------------------------------------------
assert.deepEqual(columnExtent(rows, "roi", {}), { min: 1.2, max: 30.2 });
assert.deepEqual(columnExtent(rows, "roi", trendUp), { min: 8.7, max: 15.0 });
assert.equal(
  columnExtent(rows, "roi", { name: { kind: "text", query: "nothing matches this" } }),
  null,
  "no rows in range means no hint rather than a bogus 0-0",
);
// A column of nulls has no extent even though rows are in range.
assert.equal(columnExtent([{ x: null }, { x: null }], "x", {}), null);

// --- pill descriptions -------------------------------------------------------------------
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
assert.equal(describeColumnFilter("ROI", { kind: "range", min: 10, max: null }), "ROI ≥ 10");
assert.equal(describeColumnFilter("ROI", { kind: "range", min: null, max: 10 }), "ROI ≤ 10");
assert.equal(describeColumnFilter("ROI", { kind: "range", min: 1, max: 10 }), "ROI 1–10");
assert.equal(describeColumnFilter("Volume", { kind: "range", min: 41109, max: null }, k), "Volume ≥ 41.1K");
assert.equal(describeColumnFilter("Trend", { kind: "set", values: ["up"] }), "Trend: up");
assert.equal(describeColumnFilter("Trend", { kind: "set", values: ["up", "down"] }), "Trend: 2 selected");
assert.equal(describeColumnFilter("Item", { kind: "text", query: " whip " }), 'Item contains "whip"');

// --- state hygiene ---------------------------------------------------------------------------
let state: ColumnFilters = {};
state = setColumnFilter(state, "roi", { kind: "range", min: 5, max: null });
assert.equal(activeColumnCount(state), 1);
state = setColumnFilter(state, "trend", { kind: "set", values: [] });
assert.deepEqual(Object.keys(state), ["roi"], "a no-op filter is dropped rather than stored");
state = setColumnFilter(state, "roi", null);
assert.equal(activeColumnCount(state), 0);
assert.deepEqual(state, {});

console.log(
  `ok — column filters: range/set/text over ${rows.length} rows, null≠0, array cells match any, ` +
    `facet counts exclude own dimension, extents follow the rest`,
);
