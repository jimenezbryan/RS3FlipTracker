import { useQuery } from "@tanstack/react-query";
import { Radar, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatGP, formatNumber } from "@/lib/formatters";

/** Mirrors RadarResult in server/update-radar.ts. */
interface RadarItem {
  id: number;
  name: string;
  examine?: string;
  icon: string;
  volume: number;
  price: number;
  priceWas: number;
  changePct: number;
}

interface RadarTheme {
  token: string;
  moverCount: number;
  lift: number;
  coherence: number;
  direction: "up" | "down";
  medianMovePct: number;
  items: RadarItem[];
}

interface RadarResult {
  themes: RadarTheme[];
  topMovers: RadarItem[];
  moverThresholdPct: number;
  moverCount: number;
  universeCount: number;
  generatedAt: string;
}

function Change({ pct }: { pct: number }) {
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function ItemRow({ item }: { item: RadarItem }) {
  return (
    <div className="flex items-center gap-3 py-2" data-testid={`row-radar-item-${item.id}`}>
      <img src={item.icon} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />
      <span className="text-sm truncate flex-1 min-w-0">{item.name}</span>
      <span className="font-mono text-xs text-muted-foreground shrink-0 hidden sm:inline">
        {formatGP(item.priceWas)} &rarr; {formatGP(item.price)}
      </span>
      <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 text-right hidden md:inline">
        {formatGP(item.volume)}
      </span>
      <span className="shrink-0 w-20 text-right">
        <Change pct={item.changePct} />
      </span>
    </div>
  );
}

export default function UpdateRadar() {
  const { data, isLoading, error } = useQuery<RadarResult>({
    queryKey: ["/api/radar/themes"],
    refetchInterval: 15 * 60 * 1000,
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Radar className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Update Radar
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Groups of items moving together and sharing vocabulary &mdash; what the market is reacting to, found
            without reading the patch notes.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            data-testid="text-radar-error"
          >
            Failed to build the radar. The wiki price API may be unreachable.
          </div>
        )}

        {data && (
          <>
            <div className="rounded-lg border bg-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span data-testid="text-radar-universe">
                <span className="font-mono font-semibold">{formatNumber(data.universeCount)}</span>
                <span className="text-muted-foreground"> items with a real two-way book</span>
              </span>
              <span>
                <span className="font-mono font-semibold">{formatNumber(data.moverCount)}</span>
                <span className="text-muted-foreground"> moving at least {data.moverThresholdPct.toFixed(1)}%</span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-muted-foreground cursor-help">
                    <Info className="h-3.5 w-3.5" />
                    95th percentile
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  The bar for "moving" is the top 5% of today's moves, not a fixed percentage. A fixed threshold is
                  only ever calibrated for one market and fires on everything in another.
                </TooltipContent>
              </Tooltip>
              <span className="ml-auto text-xs text-muted-foreground">
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            {data.themes.length === 0 ? (
              <div
                className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground"
                data-testid="text-radar-no-themes"
              >
                No coherent theme right now. On a day with no update, that is the correct answer &mdash; the movers
                below are unrelated to each other.
              </div>
            ) : (
              <div className="space-y-4">
                {data.themes.map((theme) => (
                  <div key={theme.token} className="rounded-lg border bg-card p-4" data-testid={`card-theme-${theme.token}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h2 className="text-lg font-semibold font-mono" data-testid={`text-theme-token-${theme.token}`}>
                        {theme.token}
                      </h2>
                      <Badge variant="outline">{theme.moverCount} movers</Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help">
                            {theme.lift.toFixed(1)}x baseline
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          This word is {theme.lift.toFixed(1)} times more common among today's movers than across the
                          whole market. 1.0x would mean no signal at all.
                        </TooltipContent>
                      </Tooltip>
                      <Badge
                        variant="outline"
                        className={theme.direction === "up" ? "text-emerald-400" : "text-red-400"}
                      >
                        {Math.round(theme.coherence * 100)}% {theme.direction}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        median {theme.medianMovePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="divide-y">
                      {theme.items.map((item) => (
                        <ItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Top movers, clustered or not
              </h2>
              <div className="divide-y">
                {data.topMovers.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Prices compare the mid of one hourly block to the same block 24h ago, and only for items where both
              sides of the book traded real size. Thin quotes are excluded &mdash; a dozen units dumped at 1gp is
              not a price move.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
