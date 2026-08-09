import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import {
  columnExtent,
  columnOptions,
  isNoOp,
  type ColumnFilter as ColumnFilterValue,
  type ColumnFilters,
  type FilterableRow,
} from "@shared/columnFilters";

export type ColumnKind = "range" | "set" | "text";

export interface ColumnFilterSpec {
  /** Field on the row. Also the key in the ColumnFilters record. */
  key: string;
  label: string;
  kind: ColumnKind;
  /** Renders a value in the option list and the range hint. Defaults to as-written. */
  format?: (value: number) => string;
  /** Renders a "set" option's raw string as a label — "true" is not a word users read. */
  optionLabel?: (value: string) => string;
}

interface ColumnFilterProps {
  spec: ColumnFilterSpec;
  /** Rows the counts and extents are drawn from: everything reachable but for this panel. */
  rows: FilterableRow[];
  filters: ColumnFilters;
  onChange: (key: string, filter: ColumnFilterValue | null) => void;
}

/** Enough options that scanning beats reading — the same threshold the category list uses. */
const SEARCHABLE_AT = 8;

export function ColumnFilter({ spec, rows, filters, onChange }: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = filters[spec.key];
  const active = !isNoOp(current);

  // Only computed while open. Faceting walks every row per column, and the header renders one
  // of these per column — doing that eagerly would cost a full pass per column per keystroke.
  const options = useMemo(
    () => (open && spec.kind === "set" ? columnOptions(rows, spec.key, filters) : []),
    [open, spec.kind, spec.key, rows, filters],
  );
  const extent = useMemo(
    () => (open && spec.kind === "range" ? columnExtent(rows, spec.key, filters) : null),
    [open, spec.kind, spec.key, rows, filters],
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => (spec.optionLabel?.(o.value) ?? o.value).toLowerCase().includes(q));
  }, [options, query, spec]);

  const fmt = spec.format ?? ((n: number) => n.toLocaleString());

  const range = current?.kind === "range" ? current : null;
  const selected = current?.kind === "set" ? current.values : [];
  const text = current?.kind === "text" ? current.query : "";

  const setRange = (bound: "min" | "max", raw: string) => {
    const parsed = raw.trim() === "" ? null : Number(raw);
    const value = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    onChange(spec.key, {
      kind: "range",
      min: bound === "min" ? value : (range?.min ?? null),
      max: bound === "max" ? value : (range?.max ?? null),
    });
  };

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(spec.key, { kind: "set", values: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // stopPropagation: every one of these sits inside a header cell whose click sorts.
          onClick={(e) => e.stopPropagation()}
          className={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
            active
              ? "text-cyan-400"
              : "text-muted-foreground/40 hover:text-foreground focus-visible:text-foreground"
          }`}
          aria-label={active ? `${spec.label} filter active` : `Filter by ${spec.label}`}
          data-testid={`column-filter-${spec.key}`}
          data-active={active}
        >
          <Filter className={`h-3 w-3 ${active ? "fill-current" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
        data-testid={`column-filter-panel-${spec.key}`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {spec.label}
          </span>
          {active && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange(spec.key, null)}
              data-testid={`column-filter-clear-${spec.key}`}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {spec.kind === "range" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={extent ? fmt(extent.min) : "min"}
                value={range?.min ?? ""}
                onChange={(e) => setRange("min", e.target.value)}
                className="h-8 text-xs"
                data-testid={`column-filter-min-${spec.key}`}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={extent ? fmt(extent.max) : "max"}
                value={range?.max ?? ""}
                onChange={(e) => setRange("max", e.target.value)}
                className="h-8 text-xs"
                data-testid={`column-filter-max-${spec.key}`}
              />
            </div>
            {/* The placeholders already carry the bounds; this says what they are, so an
                empty box reads as "everything" rather than as a value of zero. */}
            <p className="text-[11px] text-muted-foreground">
              {extent
                ? `Present in view: ${fmt(extent.min)} – ${fmt(extent.max)}. Blank means no bound.`
                : "Nothing in view carries a value for this column."}
            </p>
          </div>
        )}

        {spec.kind === "set" && (
          <div className="space-y-2">
            {options.length >= SEARCHABLE_AT && (
              <Input
                placeholder="Search values…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-xs"
                data-testid={`column-filter-search-${spec.key}`}
              />
            )}
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {searched.length === 0 && (
                <p className="py-2 text-[11px] text-muted-foreground">
                  {options.length === 0 ? "No values in view." : "No value matches that search."}
                </p>
              )}
              {searched.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)}
                    data-testid={`column-filter-option-${spec.key}-${option.value}`}
                  />
                  <span className="flex-1 truncate">
                    {spec.optionLabel?.(option.value) ?? option.value}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {option.count.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {spec.kind === "text" && (
          <Input
            placeholder={`Contains…`}
            value={text}
            onChange={(e) => onChange(spec.key, { kind: "text", query: e.target.value })}
            className="h-8 text-xs"
            data-testid={`column-filter-text-${spec.key}`}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
