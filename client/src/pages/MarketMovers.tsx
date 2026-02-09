import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, Activity, BarChart3, Zap, Target,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGP } from "@/lib/formatters";

interface MarketMover {
  itemId: number;
  itemName: string;
  currentPrice: number;
  volume: number;
  members: boolean;
  price24hAgo: number;
  price7dAgo: number;
  change24h: number;
  change7d: number;
  changePercent24h: number;
  changePercent7d: number;
}

interface MarketMoversData {
  gainers: MarketMover[];
  losers: MarketMover[];
  mostActive: MarketMover[];
  timestamp: number;
}

type TabKey = "gainers" | "losers" | "mostActive";

function MiniSparkline({ change24h, change7d }: { change24h: number; change7d: number }) {
  const trend = change24h > 0 ? "up" : change24h < 0 ? "down" : "stable";
  const points = useMemo(() => {
    const data: number[] = [];
    const base = 50;
    const direction = trend === "up" ? 1 : trend === "down" ? -1 : 0;
    for (let i = 0; i < 8; i++) {
      const trendVal = direction * (i / 7) * 12;
      const noise = Math.sin(i * 2.1) * 3 + Math.cos(i * 1.3) * 2;
      data.push(base + trendVal + noise);
    }
    return data;
  }, [trend]);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const pathD = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 36;
      const y = 14 - ((p - min) / range) * 12;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const color =
    trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280";

  return (
    <svg width="36" height="16" className="inline-block">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accent = "cyan",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accent?: "cyan" | "green" | "red" | "purple";
}) {
  const accentColors = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400",
    green: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-gradient-to-br ${accentColors[accent]} backdrop-blur-sm p-4`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-bold mt-1 truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <Icon className="h-5 w-5 opacity-60 shrink-0" />
      </div>
      <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-current opacity-5" />
    </div>
  );
}

function ChangeCell({ value, percent }: { value: number; percent: number }) {
  const isPositive = value > 0;
  const isZero = value === 0;
  const color = isZero
    ? "text-muted-foreground"
    : isPositive
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      {!isZero &&
        (isPositive ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" />
        ))}
      {isZero && <Minus className="h-3.5 w-3.5" />}
      <span className="text-sm font-medium">
        {isZero ? "0" : `${isPositive ? "+" : ""}${percent.toFixed(2)}%`}
      </span>
    </div>
  );
}

function MoversTable({ items }: { items: MarketMover[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-movers-empty">
        No data available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700/50 hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
              Item
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
              Price
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
              24h Change
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
              7d Change
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">
              Volume
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-center">
              Trend
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={item.itemId}
              className="border-slate-700/50 hover:bg-slate-800/50 transition-colors"
              data-testid={`row-mover-${item.itemId}`}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <img
                    src={`https://secure.runescape.com/m=itemdb_rs/obj_sprite.gif?id=${item.itemId}`}
                    alt={item.itemName}
                    className="w-7 h-7 object-contain"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      data-testid={`text-item-name-${item.itemId}`}
                    >
                      {item.itemName}
                    </p>
                    {item.members && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-400"
                      >
                        P2P
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className="text-sm font-mono font-medium"
                  data-testid={`text-price-${item.itemId}`}
                >
                  {formatGP(item.currentPrice)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <ChangeCell
                  value={item.change24h}
                  percent={item.changePercent24h}
                />
              </TableCell>
              <TableCell className="text-right">
                <ChangeCell
                  value={item.change7d}
                  percent={item.changePercent7d}
                />
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-mono text-muted-foreground">
                  {item.volume > 0 ? formatGP(item.volume) : "-"}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <MiniSparkline
                  change24h={item.change24h}
                  change7d={item.change7d}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-80 rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "gainers", label: "Top Gainers", icon: TrendingUp },
  { key: "losers", label: "Top Losers", icon: TrendingDown },
  { key: "mostActive", label: "Most Active", icon: Zap },
];

export default function MarketMovers() {
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");

  const { data, isLoading, error } = useQuery<MarketMoversData>({
    queryKey: ["/api/market-movers"],
    refetchInterval: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const totalItems =
      data.gainers.length + data.losers.length + data.mostActive.length;
    const topGainer = data.gainers[0];
    const topLoser = data.losers[0];
    const topActive = data.mostActive[0];
    return { totalItems, topGainer, topLoser, topActive };
  }, [data]);

  const activeItems = data?.[activeTab] ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-cyan-400" />
            <h1
              className="text-2xl font-bold tracking-tight"
              data-testid="text-page-title"
            >
              Market Movers
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Items with the biggest price changes &mdash; updated every 5 minutes
          </p>
        </div>

        {isLoading && <LoadingSkeleton />}

        {error && (
          <div
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm"
            data-testid="text-movers-error"
          >
            Failed to load market data. Please try again later.
          </div>
        )}

        {data && stats && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Items Tracked"
                value={stats.totalItems}
                icon={BarChart3}
                accent="cyan"
              />
              <StatCard
                label="Biggest Gainer"
                value={
                  stats.topGainer
                    ? `+${stats.topGainer.changePercent24h.toFixed(1)}%`
                    : "-"
                }
                subtitle={stats.topGainer?.itemName}
                icon={TrendingUp}
                accent="green"
              />
              <StatCard
                label="Biggest Loser"
                value={
                  stats.topLoser
                    ? `${stats.topLoser.changePercent24h.toFixed(1)}%`
                    : "-"
                }
                subtitle={stats.topLoser?.itemName}
                icon={TrendingDown}
                accent="red"
              />
              <StatCard
                label="Most Active"
                value={
                  stats.topActive
                    ? formatGP(stats.topActive.volume)
                    : "-"
                }
                subtitle={stats.topActive?.itemName}
                icon={Target}
                accent="purple"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                        : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                    data-testid={`button-tab-${tab.key}`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}

              <span className="ml-auto text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <MoversTable items={activeItems} />
          </>
        )}
      </div>
    </div>
  );
}
