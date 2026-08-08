import { useMemo, useState } from "react";
import { Filter, ChevronRight, X, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BUY_LIMIT_BANDS,
  PRICE_BANDS,
  UNCATEGORISED,
  facetCounts,
  categoriesByCount,
  activeFilterCount,
  type Band,
  type FilterSelection,
  type FilterableItem,
} from "@shared/scannerFilters";

/** The numeric range inputs. Kept as strings so a half-typed "-" or "" is not coerced to 0. */
export interface NumericFilters {
  minMargin: string;
  maxMargin: string;
  minVolume: string;
  maxVolume: string;
  minPotentialProfit: string;
  maxPotentialProfit: string;
  minRoi: string;
  maxRoi: string;
}

export const EMPTY_NUMERIC: NumericFilters = {
  minMargin: "", maxMargin: "", minVolume: "", maxVolume: "",
  minPotentialProfit: "", maxPotentialProfit: "", minRoi: "", maxRoi: "",
};

/** How many categories sit inline before the rest move into the popover. Enough to cover the
 *  common ones without the row wrapping into a wall. */
const INLINE_CATEGORIES = 8;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

/**
 * One filter chip with its facet count. Zero-count chips are disabled rather than hidden —
 * hiding them makes the row reflow every keystroke and hides the fact that the option exists.
 */
function FilterChip({
  label, count, selected, onClick, testId,
}: {
  label: string; count: number; selected: boolean; onClick: () => void; testId: string;
}) {
  const empty = count === 0 && !selected;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={selected}
      data-testid={testId}
      className={`group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
        disabled:cursor-not-allowed disabled:opacity-40
        ${selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted"}`}
    >
      <span>{label}</span>
      <span
        className={`font-mono text-xs tabular-nums ${
          selected ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}
      >
        {compact(count)}
      </span>
    </button>
  );
}

/** A labelled min/max pair. Four of these replace eight loose inputs. */
function RangeInput({
  label, hint, minValue, maxValue, onMin, onMax, testId,
}: {
  label: string; hint?: string; minValue: string; maxValue: string;
  onMin: (v: string) => void; onMax: (v: string) => void; testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && <span className="ml-1 normal-case tracking-normal opacity-70">{hint}</span>}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number" inputMode="numeric" placeholder="min" value={minValue}
          onChange={(e) => onMin(e.target.value)}
          className="h-8 bg-background font-mono text-sm tabular-nums"
          data-testid={`input-${testId}-min`}
        />
        <span className="text-muted-foreground" aria-hidden>–</span>
        <Input
          type="number" inputMode="numeric" placeholder="max" value={maxValue}
          onChange={(e) => onMax(e.target.value)}
          className="h-8 bg-background font-mono text-sm tabular-nums"
          data-testid={`input-${testId}-max`}
        />
      </div>
    </div>
  );
}

export interface ScannerFiltersProps {
  /** Rows with every OTHER filter already applied — search, F2P, watchlist, signals and so
   *  on. Facet counts are only honest if they are computed over what the user can actually
   *  reach right now. */
  items: FilterableItem[];
  selection: FilterSelection;
  onSelectionChange: (next: FilterSelection) => void;
  numeric: NumericFilters;
  onNumericChange: (next: NumericFilters) => void;
  /** Rows surviving everything, for the "N of M" readout. */
  resultCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScannerFilters({
  items, selection, onSelectionChange, numeric, onNumericChange, resultCount, open, onOpenChange,
}: ScannerFiltersProps) {
  const [categoryQuery, setCategoryQuery] = useState("");

  const counts = useMemo(() => facetCounts(items, selection), [items, selection]);
  const categories = useMemo(() => categoriesByCount(counts.category), [counts.category]);

  const numericActive = Object.values(numeric).filter((v) => v !== "").length;
  const activeCount = activeFilterCount(selection) + (numericActive > 0 ? 1 : 0);

  // Selected categories are pinned into the inline row, so a pick made inside the popover
  // never disappears from view the moment the popover closes.
  const inlineCategories = useMemo(() => {
    const selected = categories.filter((c) => selection.categories.includes(c.name));
    const rest = categories.filter((c) => !selection.categories.includes(c.name));
    return [...selected, ...rest.slice(0, Math.max(0, INLINE_CATEGORIES - selected.length))];
  }, [categories, selection.categories]);

  // Two lists, deliberately. The trigger counts every overflow category; only the list inside
  // the popover narrows to the query. Deriving the trigger from the searched list would
  // unmount the popover the moment a query matched nothing — closing it under the user's
  // cursor mid-keystroke.
  const overflowCategories = useMemo(() => {
    const inline = new Set(inlineCategories.map((c) => c.name));
    return categories.filter((c) => !inline.has(c.name));
  }, [categories, inlineCategories]);

  const searchedCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    return q ? overflowCategories.filter((c) => c.name.toLowerCase().includes(q)) : overflowCategories;
  }, [overflowCategories, categoryQuery]);

  const toggleCategory = (name: string) =>
    onSelectionChange({
      ...selection,
      categories: selection.categories.includes(name)
        ? selection.categories.filter((c) => c !== name)
        : [...selection.categories, name],
    });

  const toggleBand = (key: "buyLimitBandId" | "priceBandId", id: string) =>
    onSelectionChange({ ...selection, [key]: selection[key] === id ? null : id });

  const clearAll = () => {
    onSelectionChange({ buyLimitBandId: null, priceBandId: null, categories: [] });
    onNumericChange(EMPTY_NUMERIC);
  };

  const bandLabel = (bands: Band[], id: string | null) => bands.find((b) => b.id === id)?.label;

  // Active filters stay on screen when the panel is collapsed. A filter you cannot see is a
  // filter you will forget you set, and then the row count looks like a bug.
  const activePills: Array<{ key: string; label: string; clear: () => void }> = [
    ...selection.categories.map((name) => ({
      key: `cat-${name}`,
      label: name,
      clear: () => toggleCategory(name),
    })),
  ];
  const limitLabel = bandLabel(BUY_LIMIT_BANDS, selection.buyLimitBandId);
  if (limitLabel) {
    activePills.push({
      key: "limit",
      label: `Limit ${limitLabel}`,
      clear: () => onSelectionChange({ ...selection, buyLimitBandId: null }),
    });
  }
  const priceLabel = bandLabel(PRICE_BANDS, selection.priceBandId);
  if (priceLabel) {
    activePills.push({
      key: "price",
      label: `Price ${priceLabel}`,
      clear: () => onSelectionChange({ ...selection, priceBandId: null }),
    });
  }
  if (numericActive > 0) {
    activePills.push({
      key: "numeric",
      label: `${numericActive} numeric`,
      clear: () => onNumericChange(EMPTY_NUMERIC),
    });
  }

  return (
    <div className="mb-4 rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="gap-2"
          data-testid="button-toggle-filters"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="outline" className="border-primary/50 px-1.5 text-primary" data-testid="badge-active-filters">
              {activeCount}
            </Badge>
          )}
          <ChevronRight className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
        </Button>

        {activePills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={pill.clear}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5
              text-xs text-primary transition-colors duration-150 hover:bg-primary/20
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`pill-active-${pill.key}`}
          >
            {pill.label}
            <X className="h-3 w-3" aria-label={`Remove ${pill.label} filter`} />
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs text-muted-foreground" data-testid="button-clear-filters">
              Clear all
            </Button>
          )}
          <span className="font-mono text-sm tabular-nums" data-testid="text-result-count">
            {resultCount.toLocaleString()}
            <span className="text-muted-foreground"> of {items.length.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t p-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground/70">
                    {categories.length} in view
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Jagex's own Grand Exchange categories. Counts reflect every other filter you
                  have set, so they show what you would actually get.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inlineCategories.map((cat) => (
                <FilterChip
                  key={cat.name}
                  label={cat.name}
                  count={cat.count}
                  selected={selection.categories.includes(cat.name)}
                  onClick={() => toggleCategory(cat.name)}
                  testId={`chip-category-${cat.name}`}
                />
              ))}

              {overflowCategories.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border
                        bg-card px-2.5 py-1 text-sm text-muted-foreground transition-colors duration-150
                        hover:border-primary/50 hover:text-foreground
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="button-more-categories"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {overflowCategories.length} more
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-0">
                    <div className="border-b p-2">
                      <Input
                        autoFocus
                        placeholder="Search categories"
                        value={categoryQuery}
                        onChange={(e) => setCategoryQuery(e.target.value)}
                        className="h-8"
                        data-testid="input-category-search"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {searchedCategories.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No category matches that.</p>
                      ) : (
                        searchedCategories.map((cat) => (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => toggleCategory(cat.name)}
                            disabled={cat.count === 0}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm
                              transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40
                              focus-visible:outline-none focus-visible:bg-muted"
                            data-testid={`option-category-${cat.name}`}
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                              {selection.categories.includes(cat.name) && <Check className="h-3.5 w-3.5 text-primary" />}
                            </span>
                            <span className="flex-1 truncate">{cat.name}</span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {compact(cat.count)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Buy limit</Label>
              <div className="flex flex-wrap gap-1.5">
                {BUY_LIMIT_BANDS.map((band) => (
                  <FilterChip
                    key={band.id}
                    label={band.label}
                    count={counts.buyLimit[band.id] ?? 0}
                    selected={selection.buyLimitBandId === band.id}
                    onClick={() => toggleBand("buyLimitBandId", band.id)}
                    testId={`chip-limit-${band.id}`}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Buy price</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_BANDS.map((band) => (
                  <FilterChip
                    key={band.id}
                    label={band.label}
                    count={counts.price[band.id] ?? 0}
                    selected={selection.priceBandId === band.id}
                    onClick={() => toggleBand("priceBandId", band.id)}
                    testId={`chip-price-${band.id}`}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <RangeInput
              label="ROI" hint="%" testId="roi"
              minValue={numeric.minRoi} maxValue={numeric.maxRoi}
              onMin={(v) => onNumericChange({ ...numeric, minRoi: v })}
              onMax={(v) => onNumericChange({ ...numeric, maxRoi: v })}
            />
            <RangeInput
              label="Margin" hint="gp" testId="margin"
              minValue={numeric.minMargin} maxValue={numeric.maxMargin}
              onMin={(v) => onNumericChange({ ...numeric, minMargin: v })}
              onMax={(v) => onNumericChange({ ...numeric, maxMargin: v })}
            />
            <RangeInput
              label="Volume" hint="24h" testId="volume"
              minValue={numeric.minVolume} maxValue={numeric.maxVolume}
              onMin={(v) => onNumericChange({ ...numeric, minVolume: v })}
              onMax={(v) => onNumericChange({ ...numeric, maxVolume: v })}
            />
            <RangeInput
              label="Profit" hint="per flip" testId="profit"
              minValue={numeric.minPotentialProfit} maxValue={numeric.maxPotentialProfit}
              onMin={(v) => onNumericChange({ ...numeric, minPotentialProfit: v })}
              onMax={(v) => onNumericChange({ ...numeric, maxPotentialProfit: v })}
            />
          </div>

          {resultCount === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground" data-testid="text-filters-empty">
              No item matches every filter. Remove one of the pills above &mdash; the counts on each
              chip show what is still reachable.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
