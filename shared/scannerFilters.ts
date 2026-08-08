/**
 * Band definitions and facet counting for the Scanner's filters.
 *
 * Pure functions, no React, no server deps, so scripts/check-scanner-filters.ts can exercise
 * them offline. This is the third module to go to shared/ for that reason — the Scanner's
 * scoring is still trapped in a useMemo and three project logs now record it as unguarded.
 *
 * Why bands rather than the exact values the old filter listed: the live mapping carries 38
 * distinct buy limits and the UI hardcoded 8 of them, with an equality match. 1,410 items
 * (19.3%) sat on a limit no chip could select — 565 of them at limit 2500 alone. Bands defined
 * by CONTINUOUS boundaries fix that permanently: every value falls in exactly one band, and a
 * limit Jagex invents next year cannot be orphaned. An earlier cut of these bands used the
 * observed values as boundaries and silently dropped limit 20, which is the failure this
 * approach removes rather than patches.
 */

export interface Band {
  /** Stable key for URL/state, never shown. */
  id: string;
  label: string;
  min: number;
  /** Inclusive. Infinity for the open tail. */
  max: number;
}

/** Partitions the whole number line — see the note above. */
export const BUY_LIMIT_BANDS: Band[] = [
  { id: "lim-10", label: "≤ 10", min: 0, max: 10 },
  { id: "lim-100", label: "11–100", min: 11, max: 100 },
  { id: "lim-500", label: "101–500", min: 101, max: 500 },
  { id: "lim-2500", label: "501–2.5K", min: 501, max: 2_500 },
  { id: "lim-12k", label: "2.5K–12K", min: 2_501, max: 12_000 },
  { id: "lim-max", label: "12K+", min: 12_001, max: Infinity },
];

/**
 * The old top band was "10M+", open-ended over a range that runs to 80.8 BILLION gp — 457
 * items and four orders of magnitude behind one chip. Split into three, because the capital
 * required to flip a 10M item and a 10B item are not the same decision.
 */
export const PRICE_BANDS: Band[] = [
  { id: "px-1k", label: "Under 1K", min: 0, max: 999 },
  { id: "px-10k", label: "1K–10K", min: 1_000, max: 9_999 },
  { id: "px-100k", label: "10K–100K", min: 10_000, max: 99_999 },
  { id: "px-1m", label: "100K–1M", min: 100_000, max: 999_999 },
  { id: "px-10m", label: "1M–10M", min: 1_000_000, max: 9_999_999 },
  { id: "px-100m", label: "10M–100M", min: 10_000_000, max: 99_999_999 },
  { id: "px-1b", label: "100M–1B", min: 100_000_000, max: 999_999_999 },
  { id: "px-max", label: "1B+", min: 1_000_000_000, max: Infinity },
];

export const UNCATEGORISED = "Uncategorised";

export function inBand(value: number, band: Band): boolean {
  return value >= band.min && value <= band.max;
}

export function bandById(bands: Band[], id: string | null): Band | null {
  if (!id) return null;
  return bands.find((b) => b.id === id) ?? null;
}

/** The subset of a scanner row this module needs. Keeps the checks free of the full type. */
export interface FilterableItem {
  geLimit: number;
  buyPrice: number;
  category?: string;
}

export interface FilterSelection {
  buyLimitBandId: string | null;
  priceBandId: string | null;
  /** Empty means no category constraint, not "none of them". */
  categories: string[];
}

export const EMPTY_SELECTION: FilterSelection = {
  buyLimitBandId: null,
  priceBandId: null,
  categories: [],
};

const matchesLimit = (item: FilterableItem, sel: FilterSelection) => {
  const band = bandById(BUY_LIMIT_BANDS, sel.buyLimitBandId);
  return !band || inBand(item.geLimit, band);
};

const matchesPrice = (item: FilterableItem, sel: FilterSelection) => {
  const band = bandById(PRICE_BANDS, sel.priceBandId);
  return !band || inBand(item.buyPrice, band);
};

const matchesCategory = (item: FilterableItem, sel: FilterSelection) =>
  sel.categories.length === 0 || sel.categories.includes(item.category ?? UNCATEGORISED);

export function matchesSelection(item: FilterableItem, sel: FilterSelection): boolean {
  return matchesLimit(item, sel) && matchesPrice(item, sel) && matchesCategory(item, sel);
}

/**
 * Counts shown against each chip. Each dimension is counted with every OTHER dimension
 * applied but not its own — standard faceted search. Counting with the dimension's own filter
 * applied would show the selected chip's count and zero everywhere else, which tells the user
 * nothing about where to go next.
 */
export interface FacetCounts {
  buyLimit: Record<string, number>;
  price: Record<string, number>;
  category: Record<string, number>;
}

export function facetCounts(items: FilterableItem[], sel: FilterSelection): FacetCounts {
  const buyLimit: Record<string, number> = {};
  const price: Record<string, number> = {};
  const category: Record<string, number> = {};

  for (const band of BUY_LIMIT_BANDS) buyLimit[band.id] = 0;
  for (const band of PRICE_BANDS) price[band.id] = 0;

  for (const item of items) {
    const okLimit = matchesLimit(item, sel);
    const okPrice = matchesPrice(item, sel);
    const okCategory = matchesCategory(item, sel);

    if (okPrice && okCategory) {
      for (const band of BUY_LIMIT_BANDS) if (inBand(item.geLimit, band)) buyLimit[band.id]++;
    }
    if (okLimit && okCategory) {
      for (const band of PRICE_BANDS) if (inBand(item.buyPrice, band)) price[band.id]++;
    }
    if (okLimit && okPrice) {
      const name = item.category ?? UNCATEGORISED;
      category[name] = (category[name] ?? 0) + 1;
    }
  }

  return { buyLimit, price, category };
}

/** Categories present in the data, most populous first, so the list leads with what exists. */
export function categoriesByCount(counts: Record<string, number>): Array<{ name: string; count: number }> {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function activeFilterCount(sel: FilterSelection): number {
  return (
    (sel.buyLimitBandId ? 1 : 0) + (sel.priceBandId ? 1 : 0) + (sel.categories.length > 0 ? 1 : 0)
  );
}
