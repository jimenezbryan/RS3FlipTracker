import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { XAxis, YAxis, CartesianGrid, Area, Line, Scatter, ComposedChart, Cell, ZAxis, ReferenceArea } from "recharts";
import { TrendingUp, TrendingDown, Minus, X, CircleDot } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Flip } from "@shared/schema";
import { calculatePriceZones, movingAverage, ZONE_LABELS, type Zone } from "@shared/priceZones";

interface PriceHistoryPoint {
  date: string;
  price: number;
  volume?: number;
  /** Instant-buy / instant-sell. Intraday periods only. */
  high?: number;
  low?: number;
  userBuy?: number;
  userSell?: number;
}

interface UserTrade {
  /** Full timestamp, not a date. Two flips on the same day are two points. */
  timestamp: number;
  price: number;
  type: "buy" | "sell";
  quantity: number;
}

type ChartPeriod = "24h" | "7d" | "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  "24h": "24H",
  "7d": "7D",
  daily: "90D",
  weekly: "6M",
  monthly: "1Y",
  yearly: "ALL",
};

/** Moving-average window per timeframe, chosen so the line spans a meaningful unit of time
 *  rather than a fixed point count: 6h on the 24H view, 1 day on 7D, 1 week on 90D. */
const MA_PERIOD: Record<ChartPeriod, number> = {
  "24h": 6,
  "7d": 24,
  daily: 7,
  weekly: 4,
  monthly: 3,
  yearly: 3,
};

const MA_LABEL: Record<ChartPeriod, string> = {
  "24h": "6h avg",
  "7d": "24h avg",
  daily: "7d avg",
  weekly: "4w avg",
  monthly: "3m avg",
  yearly: "3m avg",
};

const isIntraday = (p: ChartPeriod) => p === "24h" || p === "7d";

const ZONE_BADGE_CLASS: Record<Zone, string> = {
  buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  sell: "bg-red-500/10 text-red-400 border-red-500/30",
  accumulation: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  neutral: "bg-muted text-muted-foreground border-transparent",
};

interface PriceHistoryChartProps {
  itemId?: number;
  itemName: string;
  onClose?: () => void;
  userFlips?: Flip[];
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function PriceHistoryChart({ itemId, itemName, onClose, userFlips = [] }: PriceHistoryChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>("daily");

  const { data: resolvedItem, isLoading: isResolvingId } = useQuery<{ id: number; name: string }>({
    queryKey: ["/api/ge/resolve-id", itemName],
    queryFn: async () => {
      const response = await fetch(`/api/ge/resolve-id?name=${encodeURIComponent(itemName)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to resolve item ID");
      return response.json();
    },
    enabled: !itemId && !!itemName,
    staleTime: 1000 * 60 * 60,
  });

  const effectiveItemId = itemId || resolvedItem?.id;

  const { data: history, isLoading: isLoadingHistory, error } = useQuery<PriceHistoryPoint[]>({
    queryKey: ["/api/ge/history", effectiveItemId, period],
    queryFn: async () => {
      const response = await fetch(`/api/ge/history/${effectiveItemId}?period=${period}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: !!effectiveItemId,
  });

  const isLoading = isResolvingId || isLoadingHistory;

  const { data: trend } = useQuery<{
    direction: "rising" | "falling" | "stable";
    changePercent: number;
    changeAmount: number;
    avgPrice7d: number;
    avgPrice30d: number;
    lowPrice30d: number;
    highPrice30d: number;
    recommendation: "buy" | "sell" | "hold";
    recommendationReason: string;
  }>({
    queryKey: ["/api/ge/trend", effectiveItemId],
    enabled: !!effectiveItemId,
  });

  // buyDate/sellDate are full timestamps in the schema. This used to round them to
  // "yyyy-MM-dd" and re-parse, which put every trade at local midnight — two flips on one
  // day stacked on a single x position, and on an intraday view they would all pile onto
  // the same tick. Keep the real time.
  const userTrades: UserTrade[] = userFlips
    .filter(f => f.itemName.toLowerCase() === itemName.toLowerCase())
    .flatMap(flip => {
      const trades: UserTrade[] = [];
      if (flip.buyDate) {
        trades.push({
          timestamp: new Date(flip.buyDate).getTime(),
          price: flip.buyPrice,
          type: "buy",
          quantity: flip.quantity,
        });
      }
      if (flip.sellDate && flip.sellPrice) {
        trades.push({
          timestamp: new Date(flip.sellDate).getTime(),
          price: flip.sellPrice,
          type: "sell",
          quantity: flip.quantity,
        });
      }
      return trades;
    })
    .filter(t => Number.isFinite(t.timestamp));

  const formatPrice = (price: number) => {
    if (price >= 1000000000) {
      return `${(price / 1000000000).toFixed(1)}B`;
    }
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`;
    }
    if (price >= 1000) {
      return `${(price / 1000).toFixed(1)}K`;
    }
    return price.toLocaleString();
  };

  const formatFullPrice = (price: number) => Math.round(price).toLocaleString();

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "falling":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return "text-muted-foreground";
    switch (trend.direction) {
      case "rising":
        return "text-success";
      case "falling":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getRecommendationBadgeClass = () => {
    if (!trend) return "bg-muted text-muted-foreground";
    switch (trend.recommendation) {
      case "buy":
        return "bg-success/10 text-success border-success/20";
      case "sell":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="chart-loading">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{itemName}</CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-chart">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !history || history.length === 0) {
    return (
      <Card data-testid="chart-error">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{itemName}</CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-chart">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No price history available
          </div>
        </CardContent>
      </Card>
    );
  }

  const allPrices = [
    ...history.map(h => h.price),
    ...userTrades.map(t => t.price)
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1 || maxPrice * 0.05;

  const sortedTrades = [...userTrades].sort((a, b) => a.timestamp - b.timestamp);

  // Nudge exact collisions apart by a second so two trades at the same instant both render.
  const tradesWithUniqueTimestamps = sortedTrades.map((t, globalIndex) => ({
    ...t,
    uniqueTimestamp: t.timestamp + globalIndex,
  }));

  const buyScatterData = tradesWithUniqueTimestamps
    .filter(t => t.type === "buy")
    .map(t => ({ 
      timestamp: t.uniqueTimestamp,
      price: t.price, 
      quantity: t.quantity,
      label: `Buy: ${t.quantity.toLocaleString()} @ ${formatFullPrice(t.price)} gp`
    }));
  
  const sellScatterData = tradesWithUniqueTimestamps
    .filter(t => t.type === "sell")
    .map(t => ({ 
      timestamp: t.uniqueTimestamp,
      price: t.price, 
      quantity: t.quantity,
      label: `Sell: ${t.quantity.toLocaleString()} @ ${formatFullPrice(t.price)} gp`
    }));

  // Zones and the moving average are both computed from the VISIBLE window, so switching
  // timeframe recomputes them. Deliberate: the bands always describe the candles on screen.
  // The cost is that 24H and 90D can disagree about the same item at the same moment.
  const zones = calculatePriceZones(history);
  const maSeries = movingAverage(history.map(h => h.price), MA_PERIOD[period]);

  const chartDataWithTimestamps = history.map((h, i) => ({
    ...h,
    timestamp: new Date(h.date).getTime(),
    ma: maSeries[i],
  }));

  const firstPrice = history[0]?.price;
  const lastPrice = history[history.length - 1]?.price;
  const windowChangePct =
    firstPrice && firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;

  const allTimestamps = [
    ...chartDataWithTimestamps.map(d => d.timestamp),
    ...buyScatterData.map(d => d.timestamp),
    ...sellScatterData.map(d => d.timestamp),
  ];
  const minTimestamp = Math.min(...allTimestamps);
  const maxTimestamp = Math.max(...allTimestamps);

  return (
    <Card data-testid={`chart-price-history-${effectiveItemId || 'pending'}`}>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{itemName}</CardTitle>
            {trend && (
              <div className="flex items-center gap-1">
                {getTrendIcon()}
                <span className={`font-mono text-sm ${getTrendColor()}`}>
                  {trend.changePercent >= 0 ? "+" : ""}{trend.changePercent.toFixed(1)}%
                </span>
              </div>
            )}
            {zones && (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ZONE_BADGE_CLASS[zones.zone]}`}
                title={
                  `Where the current price sits in the ${PERIOD_LABELS[period]} window — an ` +
                  `observation, not a recommendation. Bottom 25% is at or below ` +
                  `${formatFullPrice(zones.buyMax)} gp, top 25% at or above ` +
                  `${formatFullPrice(zones.sellMin)} gp. ` +
                  `Accumulation = mid-range with volume above the window median. ` +
                  `Recomputed per timeframe, so other tabs may read differently.`
                }
                data-testid="badge-price-zone"
              >
                {ZONE_LABELS[zones.zone]}
              </span>
            )}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-chart">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1" data-testid="chart-period-selector">
          {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              className={period === p ? "bg-cyan-600 text-white" : "text-muted-foreground"}
              data-testid={`button-period-${p}`}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart data={chartDataWithTimestamps} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${effectiveItemId || 'pending'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            {/* Zones sit behind everything. Quartiles of the visible window: bottom 25%
                buy, top 25% sell, and the middle band only counts as Accumulation when
                recent volume is above the window median — the same meaning Scanner gives
                the word. Rendered before the Area so price draws on top. */}
            {zones && (
              <>
                <ReferenceArea
                  y1={minPrice - padding}
                  y2={zones.buyMax}
                  fill="#22c55e"
                  fillOpacity={0.10}
                  ifOverflow="extendDomain"
                />
                <ReferenceArea
                  y1={zones.buyMax}
                  y2={zones.sellMin}
                  fill={zones.accumulating ? "#f59e0b" : "#94a3b8"}
                  fillOpacity={zones.accumulating ? 0.12 : 0.04}
                  ifOverflow="extendDomain"
                />
                <ReferenceArea
                  y1={zones.sellMin}
                  y2={maxPrice + padding}
                  fill="#ef4444"
                  fillOpacity={0.10}
                  ifOverflow="extendDomain"
                />
              </>
            )}
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => {
                const d = new Date(ts);
                if (period === "24h") return format(d, "HH:mm");
                if (period === "7d") return format(d, "EEE HH:mm");
                if (period === "yearly") return format(d, "MMM yyyy");
                if (period === "monthly") return format(d, "MMM yy");
                if (period === "weekly") return format(d, "MMM d");
                return format(d, "MMM d");
              }}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              type="number"
              domain={[minTimestamp, maxTimestamp]}
              scale="time"
            />
            <YAxis
              dataKey="price"
              domain={[minPrice - padding, maxPrice + padding]}
              tickFormatter={formatPrice}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <ZAxis dataKey="quantity" range={[80, 200]} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(ts) => {
                    try {
                      const numTs = Number(ts);
                      const date = isNaN(numTs) ? new Date(ts as string) : new Date(numTs);
                      if (isNaN(date.getTime())) return String(ts);
                      return format(date, isIntraday(period) ? "MMM d, HH:mm" : "MMM d, yyyy");
                    } catch {
                      return String(ts);
                    }
                  }}
                  formatter={(value, name, props) => {
                    if (name === "Your Buys") {
                      const label = props?.payload?.label || "";
                      return [label, "Buy Trade"];
                    }
                    if (name === "Your Sells") {
                      const label = props?.payload?.label || "";
                      return [label, "Sell Trade"];
                    }
                    if (name === MA_LABEL[period]) {
                      return [formatFullPrice(value as number) + " gp", MA_LABEL[period]];
                    }
                    return [formatFullPrice(value as number) + " gp", "GE Price"];
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill={`url(#gradient-${effectiveItemId || 'pending'})`}
            />
            {/* Dashed and muted so it reads as secondary to price. connectNulls={false}
                keeps the line from being drawn across the leading nulls, where there is not
                yet a full window to average. */}
            <Line
              type="monotone"
              dataKey="ma"
              name={MA_LABEL[period]}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {buyScatterData.length > 0 && (
              <Scatter
                name="Your Buys"
                data={buyScatterData}
                dataKey="price"
                fill="#22c55e"
                shape="circle"
              />
            )}
            {sellScatterData.length > 0 && (
              <Scatter
                name="Your Sells"
                data={sellScatterData}
                dataKey="price"
                fill="#ef4444"
                shape="circle"
              />
            )}
          </ComposedChart>
        </ChartContainer>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {userTrades.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Your Buys</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Your Sells</span>
              </div>
              <span>{userTrades.length} trade{userTrades.length !== 1 ? "s" : ""} shown</span>
              <span className="text-muted-foreground/70">|</span>
            </>
          )}
          <div className="flex items-center gap-1">
            <div className="h-0 w-4 border-t border-dashed border-muted-foreground" />
            <span>{MA_LABEL[period]}</span>
          </div>
          {zones && (
            <>
              <span className="text-muted-foreground/70">|</span>
              <span className="text-emerald-400">Bottom 25% &le; {formatFullPrice(zones.buyMax)}</span>
              <span className="text-red-400">Top 25% &ge; {formatFullPrice(zones.sellMin)}</span>
            </>
          )}
        </div>

        {/* Window change, from the visible series rather than the trend endpoint — so the
            number always describes the timeframe the user is actually looking at. */}
        {windowChangePct !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{PERIOD_LABELS[period]} change</span>
            <span
              className={`font-mono font-medium ${
                windowChangePct > 0 ? "text-success" : windowChangePct < 0 ? "text-destructive" : "text-muted-foreground"
              }`}
              data-testid="text-window-change"
            >
              {windowChangePct >= 0 ? "+" : ""}{windowChangePct.toFixed(2)}%
            </span>
            <span className="text-muted-foreground">
              {formatFullPrice(history[0].price)} &rarr; {formatFullPrice(lastPrice)} gp
            </span>
            <span className="text-muted-foreground/70">
              ({history.length} point{history.length !== 1 ? "s" : ""})
            </span>
          </div>
        )}

        {trend && (
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div className="space-y-1">
              <div className="text-muted-foreground">7-Day Avg</div>
              <div className="font-mono font-medium" data-testid="text-avg-7d">
                {formatFullPrice(trend.avgPrice7d)} gp
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">30-Day Avg</div>
              <div className="font-mono font-medium" data-testid="text-avg-30d">
                {formatFullPrice(trend.avgPrice30d)} gp
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">30-Day Low</div>
              <div className="font-mono font-medium text-success" data-testid="text-low-30d">
                {formatFullPrice(trend.lowPrice30d)} gp
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">30-Day High</div>
              <div className="font-mono font-medium text-destructive" data-testid="text-high-30d">
                {formatFullPrice(trend.highPrice30d)} gp
              </div>
            </div>
          </div>
        )}

        {trend && (
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <div className={`rounded-full px-2 py-1 text-xs font-medium border ${getRecommendationBadgeClass()}`} data-testid="badge-recommendation">
              {trend.recommendation.toUpperCase()}
            </div>
            <div className="text-sm text-muted-foreground" data-testid="text-recommendation-reason">
              {trend.recommendationReason}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
