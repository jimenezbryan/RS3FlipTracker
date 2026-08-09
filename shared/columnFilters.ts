/**
 * Per-column filtering for the Scanner table.
 *
 * Pure functions, no React, no server deps, so scripts/check-column-filters.ts can exercise
 * them offline — the fourth module in shared/ for that reason.
 *
 * Two kinds of column, because two kinds of question:
 *   - "range"  numeric columns. The popover shows the min and max actually present in the
 *              data, so the bounds are discoverable rather than guessed at.
 *   - "set"    columns with a small vocabulary (trend, members, signals, category). The
 *              popover lists every value present with a count, which is literally the
 *              "filter by each column value available" ask — you cannot pick a value that
 *              isn't there, and you can see how many rows each is worth before clicking.
 *
 * Composes with the band/category selection in scannerFilters.ts by intersection. A band is a
 * coarse preset, a column range is precise; both narrowing at once is the expected reading of
 * two active filters, not a conflict.
 */

export type ColumnFilter =
  | { kind: "range"; min: number | null; max: number | null }
  | { kind: "set"; values: string[] }
  | { kind: "text"; query: string };

/** Keyed by column key. A key absent from the record is a column with no filter on it. */
export type ColumnFilters = Record<string, ColumnFilter>;

export const EMPTY_COLUMN_FILTERS: ColumnFilters = {};

/** What a cell can hold. `string[]` is the signals column — a row carries several at once. */
export type CellValue = string | number | boolean | null | undefined | string[];

export type FilterableRow = Record<string, CellValue>;

/**
 * A cell's value as the list of options it belongs to. Empty means "this row offers nothing
 * to match", which is how a row with no signals stays unmatched by any signal filter rather
 * than matching all of them.
 */
export function cellOptions(value: CellValue): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "boolean") return [String(value)];
  return [String(value)];
}

/** True when the filter is present but constrains nothing — an empty box is not a filter. */
export function isNoOp(filter: ColumnFilter | undefined): boolean {
  if (!filter) return true;
  if (filter.kind === "range") return filter.min === null && filter.max === null;
  if (filter.kind === "set") return filter.values.length === 0;
  return filter.query.trim() === "";
}

function matchesOne(value: CellValue, filter: ColumnFilter): boolean {
  if (isNoOp(filter)) return true;

  if (filter.kind === "range") {
    // A null cell is absent, not zero — the same rule the sort comparator uses for
    // changePct24h. Absent cannot satisfy a bound, so a bounded column excludes it.
    if (value === null || value === undefined || value === "") return false;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return false;
    if (filter.min !== null && n < filter.min) return false;
    if (filter.max !== null && n > filter.max) return false;
    return true;
  }

  if (filter.kind === "set") {
    const options = cellOptions(value);
    return options.some((o) => filter.values.includes(o));
  }

  const haystack = cellOptions(value).join(" ").toLowerCase();
  return haystack.includes(filter.query.trim().toLowerCase());
}

export function matchesColumnFilters(row: FilterableRow, filters: ColumnFilters): boolean {
  for (const key of Object.keys(filters)) {
    if (!matchesOne(row[key], filters[key])) return false;
  }
  return true;
}

/** Every filter except the one on `exceptKey` — the faceting rule, see below. */
function withoutColumn(filters: ColumnFilters, exceptKey: string): ColumnFilters {
  const rest: ColumnFilters = {};
  for (const key of Object.keys(filters)) if (key !== exceptKey) rest[key] = filters[key];
  return rest;
}

/**
 * Options present in `column`, with counts, computed with every OTHER column's filter applied
 * but not this column's own. Same rule as facetCounts() in scannerFilters.ts and for the same
 * reason: counting with the column's own filter applied would show the selected value's count
 * and zero beside everything else, which tells you nothing about where to go next.
 *
 * Sorted by count so the list leads with what the data actually holds.
 */
export function columnOptions(
  rows: FilterableRow[],
  column: string,
  filters: ColumnFilters,
): Array<{ value: string; count: number }> {
  const rest = withoutColumn(filters, column);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!matchesColumnFilters(row, rest)) continue;
    for (const option of cellOptions(row[column])) {
      counts.set(option, (counts.get(option) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * The numeric span present in `column`, again with every other column's filter applied. Null
 * when nothing in range carries a finite number, which is the signal to show no hint rather
 * than a misleading "0 – 0".
 */
export function columnExtent(
  rows: FilterableRow[],
  column: string,
  filters: ColumnFilters,
): { min: number; max: number } | null {
  const rest = withoutColumn(filters, column);
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    if (!matchesColumnFilters(row, rest)) continue;
    const raw = row[column];
    if (raw === null || raw === undefined || Array.isArray(raw) || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * A one-line reading of a filter, for the pills that keep active filters visible while the
 * panel is collapsed. `format` renders the numbers — a raw 41109 beside "Volume" is worse
 * than "41.1K".
 */
export function describeColumnFilter(
  label: string,
  filter: ColumnFilter,
  format: (n: number) => string = (n) => n.toLocaleString(),
): string {
  if (filter.kind === "range") {
    const { min, max } = filter;
    if (min !== null && max !== null) return `${label} ${format(min)}–${format(max)}`;
    if (min !== null) return `${label} ≥ ${format(min)}`;
    if (max !== null) return `${label} ≤ ${format(max)}`;
    return label;
  }
  if (filter.kind === "set") {
    if (filter.values.length === 1) return `${label}: ${filter.values[0]}`;
    return `${label}: ${filter.values.length} selected`;
  }
  return `${label} contains "${filter.query.trim()}"`;
}

export function activeColumnCount(filters: ColumnFilters): number {
  return Object.keys(filters).filter((k) => !isNoOp(filters[k])).length;
}

/** Drops no-op entries so state stays clean and `activeColumnCount` needs no special cases. */
export function setColumnFilter(
  filters: ColumnFilters,
  key: string,
  filter: ColumnFilter | null,
): ColumnFilters {
  const next = { ...filters };
  if (filter === null || isNoOp(filter)) delete next[key];
  else next[key] = filter;
  return next;
}
