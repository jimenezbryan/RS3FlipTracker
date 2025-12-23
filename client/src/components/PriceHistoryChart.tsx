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
import { XAxis, YAxis, CartesianGrid, Area, Scatter, ComposedChart, Cell, ZAxis } from "recharts";
import { TrendingUp, TrendingDown, Minus, X, CircleDot } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Flip } from "@shared/schema";

interface PriceHistoryPoint {
  date: string;
  price: number;
  volume?: number;
  userBuy?: number;
  userSell?: number;
}

interface UserTrade {
  date: string;
  price: number;
  type: "buy" | "sell";
  quantity: number;
}

interface PriceHistoryChartProps {
  itemId: number;
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
  const { data: history, isLoading, error } = useQuery<PriceHistoryPoint[]>({
    queryKey: ["/api/ge/history", itemId],
    enabled: !!itemId,
  });

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
    queryKey: ["/api/ge/trend", itemId],
    enabled: !!itemId,
  });

  const userTrades: UserTrade[] = userFlips
    .filter(f => f.itemName.toLowerCase() === itemName.toLowerCase())
    .flatMap(flip => {
      const trades: UserTrade[] = [];
      if (flip.buyDate) {
        trades.push({
          date: format(new Date(flip.buyDate), "yyyy-MM-dd"),
          price: flip.buyPrice,
          type: "buy",
          quantity: flip.quantity,
        });
      }
      if (flip.sellDate && flip.sellPrice) {
        trades.push({
          date: format(new Date(flip.sellDate), "yyyy-MM-dd"),
          price: flip.sellPrice,
          type: "sell",
          quantity: flip.quantity,
        });
      }
      return trades;
    });

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

  const sortedTrades = [...userTrades].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const tradesWithUniqueTimestamps = sortedTrades.map((t, globalIndex) => ({
    ...t,
    uniqueTimestamp: new Date(t.date).getTime() + globalIndex * 1000,
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

  const chartDataWithTimestamps = history.map(h => ({
    ...h,
    timestamp: new Date(h.date).getTime(),
  }));

  const allTimestamps = [
    ...chartDataWithTimestamps.map(d => d.timestamp),
    ...buyScatterData.map(d => d.timestamp),
    ...sellScatterData.map(d => d.timestamp),
  ];
  const minTimestamp = Math.min(...allTimestamps);
  const maxTimestamp = Math.max(...allTimestamps);

  return (
    <Card data-testid={`chart-price-history-${itemId}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
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
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-chart">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ComposedChart data={chartDataWithTimestamps} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${itemId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => format(new Date(ts), "MMM d")}
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
                  labelFormatter={(ts) => format(new Date(Number(ts)), "MMM d, yyyy")}
                  formatter={(value, name, props) => {
                    if (name === "Your Buys") {
                      const label = props?.payload?.label || "";
                      return [label, "Buy Trade"];
                    }
                    if (name === "Your Sells") {
                      const label = props?.payload?.label || "";
                      return [label, "Sell Trade"];
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
              fill={`url(#gradient-${itemId})`}
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

        {userTrades.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span>Your Buys</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Your Sells</span>
            </div>
            <span className="text-muted-foreground/70">|</span>
            <span>{userTrades.length} trade{userTrades.length !== 1 ? "s" : ""} shown</span>
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
