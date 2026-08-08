import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatGP, formatNumber } from "@/lib/formatters";

/** Mirrors AlchResult in server/alch.ts. */
interface AlchRow {
  id: number;
  name: string;
  icon: string;
  isMembers: boolean;
  buyPrice: number;
  highalch: number;
  profitPerItem: number;
  geLimit: number;
  volume: number;
  dailyCap: number;
  dailyProfit: number;
}

interface AlchResult {
  rows: AlchRow[];
  naturePrice: number;
  chargePrice: number;
  chargeCostPerItem: number;
  overheadPerItem: number;
  itemsPerDay: number;
  qualifyingCount: number;
  profitableCount: number;
  minVolume: number;
  generatedAt: string;
}

/** Volume floors, not arbitrary: the point of the filter is being able to buy thousands of
 *  units without moving the price, so the presets step by an order of magnitude. */
const VOLUME_PRESETS = [
  { value: 50_000, label: "50k" },
  { value: 100_000, label: "100k" },
  { value: 500_000, label: "500k" },
  { value: 1_000_000, label: "1M" },
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold font-mono">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Alchemy() {
  const [minVolume, setMinVolume] = useState(100_000);

  const { data, isLoading, error } = useQuery<AlchResult>({
    // One string, not [path, params]: the default queryFn is queryKey.join("/"), so an object
    // here would fetch "/api/alch/scan/[object Object]".
    queryKey: [`/api/alch/scan?minVolume=${minVolume}&limit=10`],
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              High Alchemy
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Profit per alch after nature runes and machine charge, for items liquid enough to buy in bulk.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Min volume/day</span>
          {VOLUME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setMinVolume(preset.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                minVolume === preset.value
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-volume-${preset.label}`}
            >
              {preset.label}
            </button>
          ))}
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-lg" />
              ))}
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            data-testid="text-alch-error"
          >
            Failed to load the alch scan. The wiki price API may be unreachable.
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Nature rune" value={`${formatNumber(data.naturePrice)} gp`} hint="instant-buy, one per alch" />
              <Stat
                label="Charge per alch"
                value={`${data.chargeCostPerItem.toFixed(1)} gp`}
                hint={`divine charge ${formatGP(data.chargePrice)}`}
              />
              <Stat
                label="Overhead per alch"
                value={`${Math.round(data.overheadPerItem)} gp`}
                hint="what the alch value must clear"
              />
              <Stat
                label="Throughput"
                value={`${formatNumber(data.itemsPerDay)}/day`}
                hint="2x Alchemiser mk. II"
              />
            </div>

            <p className="text-sm text-muted-foreground" data-testid="text-alch-summary">
              {formatNumber(data.qualifyingCount)} items clear {formatNumber(data.minVolume)} volume/day and the
              500,000gp machine cap &mdash; {formatNumber(data.profitableCount)} of them alch at a profit.
            </p>

            {data.rows.length === 0 ? (
              <div
                className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground"
                data-testid="text-alch-empty"
              >
                <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                Nothing clears the overhead at this volume floor. That is a real answer, not an error &mdash;
                nature runes cost more than most alch margins right now.
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wider">Item</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Buy</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Alch</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Profit/item</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Cap/day</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Profit/day</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Vol/day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.id} data-testid={`row-alch-${row.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img src={row.icon} alt="" className="w-7 h-7 object-contain" loading="lazy" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" data-testid={`text-alch-name-${row.id}`}>
                                {row.name}
                              </p>
                              {row.isMembers && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  P2P
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatGP(row.buyPrice)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatGP(row.highalch)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-400">
                          +{formatNumber(row.profitPerItem)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatNumber(row.dailyCap)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Lesser of machine throughput and the {formatNumber(row.geLimit)} buy limit across 6
                              four-hour windows.
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell
                          className="text-right font-mono text-sm font-semibold text-emerald-400"
                          data-testid={`text-alch-daily-${row.id}`}
                        >
                          {formatGP(row.dailyProfit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatGP(row.volume)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Buy prices are instant-buy, so profit assumes you fill immediately rather than waiting on an offer.
              No GE tax applies &mdash; alching is not a sale.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
