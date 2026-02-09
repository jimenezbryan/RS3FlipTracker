import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Flip } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, Target, Calendar, X, Clock, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  getWeekOfMonth,
} from "date-fns";
import { formatGP } from "@/lib/formatters";
import { calculateFlipTax } from "@shared/taxCalculator";

interface DayStats {
  date: Date;
  totalProfit: number;
  tradeCount: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface WeekStats {
  weekNumber: number;
  totalProfit: number;
  tradingDays: number;
}

interface TimelineEntry {
  flip: Flip;
  action: "BUY" | "SELL";
  timestamp: Date;
  price: number;
  quantity: number;
  profit: number | null;
  strategyTag: string | null;
  itemName: string;
  itemId: number | null;
  runningPnL: number;
}

function calculateProfit(flip: Flip): number {
  if (flip.sellPrice === null || flip.sellPrice === undefined) return 0;
  const taxDetails = calculateFlipTax(
    flip.sellPrice,
    flip.buyPrice,
    flip.quantity,
    flip.itemId ?? undefined,
    flip.itemName
  );
  return taxDetails.profit;
}

function CircularGauge({ value, maxValue = 100 }: { value: number; maxValue?: number }) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = (pct: number) => {
    if (pct >= 60) return "#10b981";
    if (pct >= 40) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="8"
          className="opacity-30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={getColor(percentage)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold font-mono" data-testid="text-win-rate-value">
          {value.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "cyan",
  badge,
  children,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  accent?: "cyan" | "green" | "purple" | "yellow";
  badge?: string;
  children?: React.ReactNode;
}) {
  const accentColors = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    green: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
    yellow: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-gradient-to-br ${accentColors[accent]} backdrop-blur-sm p-4`}
      data-testid={`card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            {badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {badge}
              </Badge>
            )}
          </div>
          {children ? (
            children
          ) : (
            <>
              <p className="text-2xl font-bold mt-1 font-mono">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </>
          )}
        </div>
        <Icon className="h-5 w-5 opacity-60 text-muted-foreground" />
      </div>
      <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-current opacity-5" />
    </div>
  );
}

function DayCell({
  day,
  stats,
  isCurrentMonth,
  isToday,
  isSelected,
  onSelect,
}: {
  day: Date;
  stats: DayStats | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (day: Date) => void;
}) {
  if (!isCurrentMonth) {
    return (
      <div
        className="aspect-square min-h-[80px] rounded-md"
        data-testid={`calendar-cell-empty`}
      />
    );
  }

  const hasTrades = stats && stats.tradeCount > 0;
  const isProfit = stats && stats.totalProfit > 0;
  const isLoss = stats && stats.totalProfit < 0;

  let bgClass = "bg-slate-800/50";
  if (hasTrades) {
    if (isProfit) {
      bgClass = "bg-teal-900/60 border-teal-700/40";
    } else if (isLoss) {
      bgClass = "bg-red-900/60 border-red-700/40";
    }
  }

  const formatDayProfit = (profit: number) => {
    const absProfit = Math.abs(profit);
    if (absProfit >= 1_000_000) {
      return `${profit >= 0 ? "+" : "-"}${(absProfit / 1_000_000).toFixed(1)}M`;
    }
    if (absProfit >= 1_000) {
      return `${profit >= 0 ? "+" : "-"}${(absProfit / 1_000).toFixed(0)}K`;
    }
    return `${profit >= 0 ? "+" : "-"}${absProfit}`;
  };

  const dateString = format(day, "yyyy-MM-dd");

  return (
    <div
      className={`aspect-square min-h-[80px] rounded-md border border-slate-700/50 ${bgClass} p-2 flex flex-col justify-between transition-all hover:border-slate-600 ${isToday ? "ring-2 ring-cyan-500/50" : ""} ${isSelected ? "ring-2 ring-cyan-400 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.3)]" : ""} ${hasTrades ? "cursor-pointer" : ""}`}
      data-testid={hasTrades ? `button-day-${dateString}` : `calendar-cell-${dateString}`}
      onClick={() => hasTrades && onSelect(day)}
      role={hasTrades ? "button" : undefined}
      tabIndex={hasTrades ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <span
          className={`text-xs font-medium ${isToday ? "text-cyan-400" : "text-muted-foreground"}`}
        >
          {format(day, "d")}
        </span>
        {hasTrades && (
          <Badge
            variant="secondary"
            className="text-[9px] px-1 py-0 h-4 bg-slate-700/50"
            data-testid={`badge-trade-count-${dateString}`}
          >
            {stats.tradeCount}
          </Badge>
        )}
      </div>
      {hasTrades && stats && (
        <div className="space-y-1">
          <p
            className={`text-sm font-bold font-mono ${isProfit ? "text-emerald-400" : isLoss ? "text-red-400" : "text-muted-foreground"}`}
            data-testid={`text-profit-${dateString}`}
          >
            {formatDayProfit(stats.totalProfit)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {stats.winRate.toFixed(0)}% win
          </p>
        </div>
      )}
    </div>
  );
}

function WeeklySummary({ week }: { week: WeekStats }) {
  const isProfit = week.totalProfit > 0;
  const isLoss = week.totalProfit < 0;

  return (
    <div
      className="rounded-md border border-slate-700/50 bg-slate-800/30 p-3 backdrop-blur-sm"
      data-testid={`card-week-${week.weekNumber}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">Week {week.weekNumber}</span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-slate-700/50"
        >
          {week.tradingDays}d
        </Badge>
      </div>
      <p
        className={`text-lg font-bold font-mono ${isProfit ? "text-emerald-400" : isLoss ? "text-red-400" : "text-muted-foreground"}`}
      >
        {isProfit ? "+" : ""}{formatGP(week.totalProfit)}
      </p>
    </div>
  );
}

function TradeReplayPanel({
  selectedDay,
  dayStats,
  timelineEntries,
  onClose,
}: {
  selectedDay: Date;
  dayStats: DayStats;
  timelineEntries: TimelineEntry[];
  onClose: () => void;
}) {
  const maxAbsPnL = useMemo(() => {
    if (timelineEntries.length === 0) return 1;
    const maxVal = Math.max(...timelineEntries.map((e) => Math.abs(e.runningPnL)));
    return maxVal || 1;
  }, [timelineEntries]);

  const finalPnL = timelineEntries.length > 0 ? timelineEntries[timelineEntries.length - 1].runningPnL : 0;

  return (
    <div
      className="mt-6 rounded-lg border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm overflow-hidden animate-in slide-in-from-top-2 duration-300"
      data-testid="panel-trade-replay"
    >
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/40">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold" data-testid="text-replay-date">
                {format(selectedDay, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-xs text-muted-foreground">Trade Replay</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                variant="secondary"
                className={`text-sm px-3 py-1 ${dayStats.totalProfit >= 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                data-testid="badge-replay-pnl"
              >
                {dayStats.totalProfit >= 0 ? "+" : ""}{formatGP(dayStats.totalProfit)}
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-slate-700/50" data-testid="badge-replay-trades">
                {dayStats.tradeCount} trades
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-slate-700/50" data-testid="badge-replay-winrate">
                {dayStats.winRate.toFixed(0)}% win rate
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-replay"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Cumulative P&L</span>
        </div>
        <div className="relative h-8 rounded-md bg-slate-800/60 overflow-hidden" data-testid="bar-cumulative-pnl">
          {timelineEntries.map((entry, idx) => {
            const barWidth = timelineEntries.length > 1 ? ((idx + 1) / timelineEntries.length) * 100 : 100;
            const isPositive = entry.runningPnL >= 0;
            return (
              <div
                key={idx}
                className={`absolute top-0 left-0 h-full transition-all duration-300 ${isPositive ? "bg-emerald-500/30" : "bg-red-500/30"}`}
                style={{ width: `${barWidth}%`, zIndex: timelineEntries.length - idx }}
              />
            );
          })}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className={`text-xs font-bold font-mono ${finalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {finalPnL >= 0 ? "+" : ""}{formatGP(finalPnL)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {timelineEntries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8" data-testid="text-no-trades">No trades on this day</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-700/60" />
            <div className="space-y-4">
              {timelineEntries.map((entry, index) => {
                const isBuy = entry.action === "BUY";
                const profit = entry.profit;
                const dotColor = isBuy
                  ? "bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                  : profit !== null && profit > 0
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    : profit !== null && profit < 0
                      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      : "bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]";

                return (
                  <div
                    key={index}
                    className="relative flex items-start gap-4 pl-0"
                    data-testid={`timeline-entry-${index}`}
                  >
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div className={`w-[10px] h-[10px] rounded-full ${dotColor}`} style={{ marginLeft: '15px' }} />
                    </div>
                    <div className="flex-1 rounded-md border border-slate-700/50 bg-slate-800/40 p-3 ml-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.itemId && (
                            <img
                              src={`https://secure.runescape.com/m=itemdb_rs/1_obj_sprite.gif?id=${entry.itemId}`}
                              alt={entry.itemName}
                              className="w-8 h-8 rounded"
                              loading="lazy"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium">{entry.itemName}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${isBuy ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                              >
                                {entry.action}
                              </Badge>
                              {entry.strategyTag && entry.strategyTag !== "Other" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  {entry.strategyTag}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-medium">
                            {formatGP(entry.price)} x {entry.quantity.toLocaleString()}
                          </p>
                          {entry.profit !== null && (
                            <p className={`text-xs font-mono font-bold mt-0.5 ${entry.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {entry.profit >= 0 ? "+" : ""}{formatGP(entry.profit)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-[10px]">{format(entry.timestamp, "h:mm a")}</span>
                        </div>
                        <span className={`text-[10px] font-mono ${entry.runningPnL >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                          Running: {entry.runningPnL >= 0 ? "+" : ""}{formatGP(entry.runningPnL)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TradingJournal() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const today = new Date();

  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const completedFlips = useMemo(() => {
    return flips.filter((f) => f.sellDate !== null && f.sellDate !== undefined);
  }, [flips]);

  const overallStats = useMemo(() => {
    const flipsWithProfit = completedFlips.map((f) => ({
      flip: f,
      profit: calculateProfit(f),
    }));

    const totalProfit = flipsWithProfit.reduce((sum, { profit }) => sum + profit, 0);
    const wins = flipsWithProfit.filter(({ profit }) => profit > 0).length;
    const losses = flipsWithProfit.filter(({ profit }) => profit < 0).length;
    const winRate = flipsWithProfit.length > 0 ? (wins / flipsWithProfit.length) * 100 : 0;

    const totalGains = flipsWithProfit
      .filter(({ profit }) => profit > 0)
      .reduce((sum, { profit }) => sum + profit, 0);
    const totalLosses = Math.abs(
      flipsWithProfit.filter(({ profit }) => profit < 0).reduce((sum, { profit }) => sum + profit, 0)
    );
    const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0;

    return {
      totalProfit,
      tradeCount: flipsWithProfit.length,
      winRate,
      profitFactor,
    };
  }, [completedFlips]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>();

    completedFlips.forEach((flip) => {
      if (!flip.sellDate) return;

      const sellDate = new Date(flip.sellDate);
      const dateKey = format(sellDate, "yyyy-MM-dd");
      const profit = calculateProfit(flip);

      const existing = map.get(dateKey);
      if (existing) {
        existing.totalProfit += profit;
        existing.tradeCount += 1;
        if (profit > 0) existing.wins += 1;
        if (profit < 0) existing.losses += 1;
        existing.winRate =
          existing.tradeCount > 0 ? (existing.wins / existing.tradeCount) * 100 : 0;
      } else {
        map.set(dateKey, {
          date: sellDate,
          totalProfit: profit,
          tradeCount: 1,
          wins: profit > 0 ? 1 : 0,
          losses: profit < 0 ? 1 : 0,
          winRate: profit > 0 ? 100 : 0,
        });
      }
    });

    return map;
  }, [completedFlips]);

  const monthlyStats = useMemo(() => {
    let totalProfit = 0;
    let tradingDays = 0;

    dayStatsMap.forEach((stats, dateKey) => {
      const date = new Date(dateKey);
      if (isSameMonth(date, currentMonth)) {
        totalProfit += stats.totalProfit;
        tradingDays += 1;
      }
    });

    return { totalProfit, tradingDays };
  }, [dayStatsMap, currentMonth]);

  const weeklyStats = useMemo(() => {
    const weeks: WeekStats[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const weekMap = new Map<number, { totalProfit: number; tradingDays: Set<string> }>();

    days.forEach((day) => {
      const weekNum = getWeekOfMonth(day, { weekStartsOn: 0 });
      const dateKey = format(day, "yyyy-MM-dd");
      const dayStats = dayStatsMap.get(dateKey);

      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, { totalProfit: 0, tradingDays: new Set() });
      }

      const week = weekMap.get(weekNum)!;
      if (dayStats) {
        week.totalProfit += dayStats.totalProfit;
        week.tradingDays.add(dateKey);
      }
    });

    weekMap.forEach((data, weekNum) => {
      weeks.push({
        weekNumber: weekNum,
        totalProfit: data.totalProfit,
        tradingDays: data.tradingDays.size,
      });
    });

    return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
  }, [currentMonth, dayStatsMap]);

  const selectedDayStats = useMemo(() => {
    if (!selectedDay) return null;
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    return dayStatsMap.get(dateKey) || null;
  }, [selectedDay, dayStatsMap]);

  const timelineEntries = useMemo((): TimelineEntry[] => {
    if (!selectedDay) return [];

    const dateKey = format(selectedDay, "yyyy-MM-dd");
    const entries: TimelineEntry[] = [];

    flips.forEach((flip) => {
      const buyDate = flip.buyDate ? new Date(flip.buyDate) : null;
      const sellDate = flip.sellDate ? new Date(flip.sellDate) : null;

      if (buyDate && format(buyDate, "yyyy-MM-dd") === dateKey) {
        entries.push({
          flip,
          action: "BUY",
          timestamp: buyDate,
          price: flip.buyPrice,
          quantity: flip.quantity,
          profit: null,
          strategyTag: flip.strategyTag,
          itemName: flip.itemName,
          itemId: flip.itemId,
          runningPnL: 0,
        });
      }

      if (sellDate && format(sellDate, "yyyy-MM-dd") === dateKey && flip.sellPrice !== null && flip.sellPrice !== undefined) {
        const profit = calculateProfit(flip);
        entries.push({
          flip,
          action: "SELL",
          timestamp: sellDate,
          price: flip.sellPrice,
          quantity: flip.quantity,
          profit,
          strategyTag: flip.strategyTag,
          itemName: flip.itemName,
          itemId: flip.itemId,
          runningPnL: 0,
        });
      }
    });

    entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let running = 0;
    entries.forEach((entry) => {
      if (entry.action === "SELL" && entry.profit !== null) {
        running += entry.profit;
      }
      entry.runningPnL = running;
    });

    return entries;
  }, [selectedDay, flips]);

  const handleDaySelect = (day: Date) => {
    if (selectedDay && isSameDay(day, selectedDay)) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDay(null);
  };
  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDay(null);
  };
  const handleThisMonth = () => {
    setCurrentMonth(new Date());
    setSelectedDay(null);
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading trading journal...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen" data-testid="page-trading-journal">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Trading Journal
          </h1>
          <p className="text-muted-foreground">Track your daily trading performance</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard
            title="Net P&L"
            value={`${overallStats.totalProfit >= 0 ? "+" : ""}${formatGP(overallStats.totalProfit)}`}
            icon={DollarSign}
            accent={overallStats.totalProfit >= 0 ? "green" : "cyan"}
            badge={`${overallStats.tradeCount} trades`}
          />

          <StatCard title="Trade Win %" value="" icon={Target} accent="purple">
            <div className="flex items-center justify-center mt-2">
              <CircularGauge value={overallStats.winRate} />
            </div>
          </StatCard>

          <StatCard
            title="Profit Factor"
            value={
              overallStats.profitFactor === Infinity
                ? "∞"
                : overallStats.profitFactor.toFixed(2)
            }
            subtitle="Total gains / Total losses"
            icon={TrendingUp}
            accent="yellow"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-lg border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold min-w-[160px] text-center" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleThisMonth}
              className="ml-2"
              data-testid="button-this-month"
            >
              This month
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={`text-sm px-3 py-1 ${monthlyStats.totalProfit >= 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
              data-testid="badge-monthly-profit"
            >
              {monthlyStats.totalProfit >= 0 ? "+" : ""}
              {formatGP(monthlyStats.totalProfit)}
            </Badge>
            <Badge
              variant="secondary"
              className="text-sm px-3 py-1 bg-slate-700/50"
              data-testid="badge-trading-days"
            >
              {monthlyStats.tradingDays} trading days
            </Badge>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/20 backdrop-blur-sm p-4">
              <div className="grid grid-cols-7 gap-2 mb-3">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2" data-testid="calendar-grid">
                {monthDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const stats = dayStatsMap.get(dateKey) || null;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);
                  const isSelected = selectedDay !== null && isSameDay(day, selectedDay);

                  return (
                    <DayCell
                      key={dateKey}
                      day={day}
                      stats={stats}
                      isCurrentMonth={isCurrentMonth}
                      isToday={isToday}
                      isSelected={isSelected}
                      onSelect={handleDaySelect}
                    />
                  );
                })}
              </div>
            </div>

            {selectedDay && selectedDayStats && (
              <TradeReplayPanel
                selectedDay={selectedDay}
                dayStats={selectedDayStats}
                timelineEntries={timelineEntries}
                onClose={() => setSelectedDay(null)}
              />
            )}
          </div>

          <div className="w-full lg:w-48 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Weekly Summary
            </h3>
            {weeklyStats.map((week) => (
              <WeeklySummary key={week.weekNumber} week={week} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
