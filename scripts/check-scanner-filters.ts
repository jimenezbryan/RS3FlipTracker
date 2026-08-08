/**
 * Self-check for the Scanner's filter bands and facet counting.
 * Run: npx tsx scripts/check-scanner-filters.ts
 * Offline, assert-based, no framework.
 *
 * The first assertion is the one that matters. The bug this redesign fixes was a hardcoded
 * list of 8 buy limits against 38 real ones, matched by equality, which made 19.3% of the
 * catalogue unreachable. A partition test is the only thing that keeps that fixed as Jagex
 * adds limits — checking the 38 values that happen to exist today would pass right up until
 * the day it matters.
 */
import assert from "node:assert/strict";
import {
  BUY_LIMIT_BANDS,
  PRICE_BANDS,
  EMPTY_SELECTION,
  UNCATEGORISED,
  facetCounts,
  matchesSelection,
  activeFilterCount,
  categoriesByCount,
  inBand,
  type FilterableItem,
} from "../shared/scannerFilters";

// ── 1. Bands partition the number line ──────────────────────────────────────────
// Not "every value we saw today lands somewhere" — every value that COULD exist.
for (const [name, bands] of [["buy limit", BUY_LIMIT_BANDS], ["price", PRICE_BANDS]] as const) {
  assert.equal(bands[0].min, 0, `${name}: first band must start at 0`);
  assert.equal(bands[bands.length - 1].max, Infinity, `${name}: last band must be open-ended`);
  for (let i = 1; i < bands.length; i++) {
    assert.equal(
      bands[i].min,
      bands[i - 1].max + 1,
      `${name}: gap or overlap between "${bands[i - 1].label}" and "${bands[i].label}" — ` +
        `a value at ${bands[i - 1].max + 1} would be unreachable`,
    );
  }
  // Every band is non-empty and ordered.
  for (const b of bands) assert.ok(b.min <= b.max, `${name}: band "${b.label}" is inverted`);
}

// The 38 buy limits live in the mapping as of 2026-08-08. Each must hit exactly one band.
const LIVE_LIMITS = [
  1, 2, 3, 4, 5, 6, 10, 20, 25, 50, 100, 120, 150, 200, 240, 250, 300, 400, 480, 500, 600,
  1000, 1200, 1500, 2000, 2500, 5000, 10000, 12000, 20000, 25000, 28000, 30000, 40000, 50000,
  100000, 500000, 600000,
];
for (const limit of LIVE_LIMITS) {
  const hits = BUY_LIMIT_BANDS.filter((b) => inBand(limit, b));
  assert.equal(hits.length, 1, `limit ${limit} matched ${hits.length} bands, expected exactly 1`);
}
// The regression that nearly shipped: limit 20 fell between "≤10" and a band starting at 25.
assert.ok(BUY_LIMIT_BANDS.some((b) => inBand(20, b)), "limit 20 must be reachable");

// Prices run to 80.8 billion; the tail must not be one open chip.
assert.ok(PRICE_BANDS.some((b) => inBand(80_807_007_000, b)), "the 80.8B item must be reachable");
assert.ok(
  PRICE_BANDS.filter((b) => b.min >= 10_000_000).length >= 3,
  "the old single 10M+ chip spanned four orders of magnitude; it must stay split",
);

// ── 2. Facet counts exclude their own dimension ─────────────────────────────────
const items: FilterableItem[] = [
  { geLimit: 5, buyPrice: 500, category: "Seeds" },
  { geLimit: 5, buyPrice: 5_000, category: "Seeds" },
  { geLimit: 100, buyPrice: 500, category: "Ammo" },
  { geLimit: 100, buyPrice: 50_000, category: "Ammo" },
  { geLimit: 25_000, buyPrice: 2_000_000_000, category: "Ammo" },
  { geLimit: 100, buyPrice: 500 }, // no category
];

const none = facetCounts(items, EMPTY_SELECTION);
assert.equal(none.buyLimit["lim-10"], 2, "two items at limit 5");
assert.equal(none.buyLimit["lim-100"], 3, "three items at limit 100");
assert.equal(none.buyLimit["lim-max"], 1, "one item at limit 25000");
assert.equal(none.price["px-max"], 1, "one item above 1B");
assert.equal(none.category[UNCATEGORISED], 1, "the item with no category is still countable");

// Selecting a buy-limit band must NOT collapse the buy-limit counts — otherwise the user can
// see only where they already are and has no idea where else to go.
const limitSelected = facetCounts(items, { ...EMPTY_SELECTION, buyLimitBandId: "lim-10" });
assert.equal(limitSelected.buyLimit["lim-100"], 3, "own dimension must ignore its own filter");
assert.equal(limitSelected.price["px-100k"], 0, "other dimensions DO narrow: no limit-5 item at 10K-100K");
assert.equal(limitSelected.category["Seeds"], 2, "category narrows to the selected limit band");
assert.equal(limitSelected.category["Ammo"], undefined, "no Ammo item sits at limit <= 10");

// ── 3. Selection semantics ──────────────────────────────────────────────────────
assert.ok(matchesSelection(items[0], EMPTY_SELECTION), "no filters means everything matches");
assert.ok(
  matchesSelection(items[0], { ...EMPTY_SELECTION, categories: [] }),
  "an empty category list means unconstrained, not 'match nothing'",
);
assert.ok(!matchesSelection(items[0], { ...EMPTY_SELECTION, categories: ["Ammo"] }));
assert.ok(
  matchesSelection(items[0], { ...EMPTY_SELECTION, categories: ["Ammo", "Seeds"] }),
  "multi-select is OR within the dimension",
);
assert.ok(
  matchesSelection(items[5], { ...EMPTY_SELECTION, categories: [UNCATEGORISED] }),
  "uncategorised items must remain filterable rather than vanishing",
);

// ── 4. Counters and ordering ────────────────────────────────────────────────────
assert.equal(activeFilterCount(EMPTY_SELECTION), 0);
assert.equal(activeFilterCount({ buyLimitBandId: "lim-10", priceBandId: "px-1k", categories: ["Ammo", "Seeds"] }), 3,
  "categories count as one active filter however many are picked");
const ordered = categoriesByCount(none.category);
assert.equal(ordered[0].name, "Ammo", "most populous category leads");
assert.deepEqual(
  categoriesByCount({ b: 2, a: 2 }).map((c) => c.name),
  ["a", "b"],
  "ties break alphabetically so the order is stable between renders",
);

// ── 5. Degenerate input ─────────────────────────────────────────────────────────
const empty = facetCounts([], EMPTY_SELECTION);
assert.equal(empty.buyLimit["lim-10"], 0, "every band key exists even with no items");
assert.deepEqual(categoriesByCount({}), []);

console.log(
  `ok — filters: ${BUY_LIMIT_BANDS.length} limit bands cover all ${LIVE_LIMITS.length} live values ` +
    `with no gap, ${PRICE_BANDS.length} price bands reach 80.8B, facet counts exclude own dimension`,
);
