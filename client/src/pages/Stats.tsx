import { useQuery } from "@tanstack/react-query";
import type { Flip } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Package, Percent, Calendar, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, subDays, startOfDay, addDays } from "date-fns";
import { calculateFlipTax } from "@shared/taxCalculator";
import { ItemLeaderboard } from "@/components/ItemLeaderboard";

function calculateProfit(flip: Flip): number | null {
  if (flip.sellPrice === null || flip.sellPrice === undefined) return null;
  const taxDetails = calculateFlipTax(flip.sellPrice, flip.buyPrice, flip.quantity, flip.itemId ?? undefined, flip.itemName);
  return taxDetails.profit;
}

function calculateROI(flip: Flip): number | null {
  if (flip.sellPrice === null || flip.sellPrice === undefined) return null;
  const taxDetails = calculateFlipTax(flip.sellPrice, flip.buyPrice, flip.quantity, flip.itemId ?? undefined, flip.itemName);
  return taxDetails.roi;
}

function calculateTax(flip: Flip): number {
  if (flip.sellPrice === null || flip.sellPrice === undefined) return 0;
  const taxDetails = calculateFlipTax(flip.sellPrice, flip.buyPrice, flip.quantity, flip.itemId ?? undefined, flip.itemName);
  return taxDetails.totalTax;
}

export default function Stats() {
  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const stats = useMemo(() => {
    const completedFlips = flips.filter(f => f.sellDate !== null && f.sellDate !== undefined);
    const openFlips = flips.filter(f => f.sellDate === null || f.sellDate === undefined);
    
    const flipsWithProfit = completedFlips
      .map(f => ({ flip: f, profit: calculateProfit(f), roi: calculateROI(f) }))
      .filter(item => item.profit !== null && item.roi !== null) as { flip: Flip; profit: number; roi: number }[];
    
    const totalProfit = flipsWithProfit.reduce((sum, { profit }) => sum + profit, 0);
    const totalInvested = flipsWithProfit.reduce((sum, { flip }) => sum + flip.buyPrice * flip.quantity, 0);
    const currentlyInvested = openFlips.reduce((sum, f) => sum + f.buyPrice * f.quantity, 0);
    const avgROI = flipsWithProfit.length > 0 
      ? flipsWithProfit.reduce((sum, { roi }) => sum + roi, 0) / flipsWithProfit.length 
      : 0;
    
    const profitableFlips = flipsWithProfit.filter(({ profit }) => profit > 0);
    const winRate = flipsWithProfit.length > 0 
      ? (profitableFlips.length / flipsWithProfit.length) * 100 
      : 0;

    const bestFlip = flipsWithProfit.length > 0 
      ? flipsWithProfit.reduce((best, curr) => curr.profit > best.profit ? curr : best).flip
      : null;
    const worstFlip = flipsWithProfit.length > 0 
      ? flipsWithProfit.reduce((worst, curr) => curr.profit < worst.profit ? curr : worst).flip
      : null;

    const totalTaxPaid = completedFlips.reduce((sum, f) => {
      return sum + calculateTax(f);
    }, 0);

    const totalGrossRevenue = completedFlips.reduce((sum, f) => {
      if (f.sellPrice !== null && f.sellPrice !== undefined) {
        return sum + (f.sellPrice * f.quantity);
      }
      return sum;
    }, 0);

    return {
      totalProfit,
      totalInvested,
      currentlyInvested,
      avgROI,
      winRate,
      completedCount: flipsWithProfit.length,
      openCount: openFlips.length,
      bestFlip,
      worstFlip,
      completedFlips,
      totalTaxPaid,
      totalGrossRevenue,
    };
  }, [flips]);

  const profitByDay = useMemo(() => {
    const last30Days: { date: string; profit: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = startOfDay(subDays(new Date(), i));
      const dayEnd = startOfDay(addDays(dayStart, 1));
      
      const dayFlips = stats.completedFlips.filter(f => {
        const sellDate = f.sellDate ? new Date(f.sellDate) : null;
        if (!sellDate) return false;
        return sellDate >= dayStart && sellDate < dayEnd;
      });

      last30Days.push({
        date: format(dayStart, "MMM d"),
        profit: dayFlips.reduce((sum, f) => sum + (calculateProfit(f) ?? 0), 0),
        count: dayFlips.length,
      });
    }
    return last30Days;
  }, [stats.completedFlips]);

  const itemProfitRanking = useMemo(() => {
    const itemProfits = new Map<string, { profit: number; count: number; icon?: string }>();
    
    stats.completedFlips.forEach(f => {
      const existing = itemProfits.get(f.itemName) || { profit: 0, count: 0, icon: f.itemIcon ?? undefined };
      const flipProfit = calculateProfit(f) ?? 0;
      itemProfits.set(f.itemName, {
        profit: existing.profit + flipProfit,
        count: existing.count + 1,
        icon: f.itemIcon ?? undefined,
      });
    });

    return Array.from(itemProfits.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [stats.completedFlips]);

  const roiDistribution = useMemo(() => {
    const ranges = [
      { range: "<0%", min: -Infinity, max: 0, count: 0, color: "hsl(0 70% 50%)" },
      { range: "0-5%", min: 0, max: 5, count: 0, color: "hsl(35 70% 50%)" },
      { range: "5-10%", min: 5, max: 10, count: 0, color: "hsl(60 70% 50%)" },
      { range: "10-20%", min: 10, max: 20, count: 0, color: "hsl(100 70% 50%)" },
      { range: "20%+", min: 20, max: Infinity, count: 0, color: "hsl(140 70% 50%)" },
    ];

    stats.completedFlips.forEach(f => {
      const roi = calculateROI(f);
      if (roi === null) return;
      const range = ranges.find(r => roi >= r.min && roi < r.max);
      if (range) range.count++;
    });

    return ranges.filter(r => r.count > 0);
  }, [stats.completedFlips]);

  const formatPrice = (price: number) => {
    if (Math.abs(price) >= 1_000_000) {
      return `${(price / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(price) >= 1_000) {
      return `${(price / 1_000).toFixed(1)}K`;
    }
    return price.toLocaleString();
  };

  const performanceByStrategy = useMemo(() => {
    const strategies: Record<string, {
      profit: number;
      roiTotal: number;
      wins: number;
      total: number;
      holdTimes: number[];
    }> = {};

    stats.completedFlips.forEach(f => {
      const strategy = f.strategyTag || "Other";
      if (!strategies[strategy]) {
        strategies[strategy] = { profit: 0, roiTotal: 0, wins: 0, total: 0, holdTimes: [] };
      }

      const profit = calculateProfit(f);
      const roi = calculateROI(f);
      
      if (profit !== null && roi !== null) {
        strategies[strategy].profit += profit;
        strategies[strategy].roiTotal += roi;
        if (profit > 0) strategies[strategy].wins++;
        strategies[strategy].total++;

        if (f.sellDate && f.buyDate) {
          const holdDays = Math.floor((new Date(f.sellDate).getTime() - new Date(f.buyDate).getTime()) / (1000 * 60 * 60 * 24));
          strategies[strategy].holdTimes.push(holdDays);
        }
      }
    });

    return Object.entries(strategies).map(([name, data]) => ({
      strategy: name,
      totalProfit: data.profit,
      avgROI: data.total > 0 ? data.roiTotal / data.total : 0,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      avgHoldTime: data.holdTimes.length > 0 ? Math.round(data.holdTimes.reduce((a, b) => a + b, 0) / data.holdTimes.length) : 0,
      flipsCount: data.total,
    })).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [stats.completedFlips]);

  if (isLoading) {
    return (
      <div className="bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading statistics...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Statistics Dashboard
          </h1>
          <p className="text-muted-foreground">Analyze your flipping performance</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card data-testid="card-total-profit">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${stats.totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {stats.totalProfit >= 0 ? "+" : ""}{formatPrice(stats.totalProfit)} gp
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From {stats.completedCount} completed flips
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-roi">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average ROI</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${stats.avgROI >= 0 ? "text-success" : "text-destructive"}`}>
                {stats.avgROI.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Win rate: {stats.winRate.toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-open-positions">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Positions</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats.openCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPrice(stats.currentlyInvested)} gp invested
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-volume">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total GP Traded</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{formatPrice(stats.totalInvested)} gp</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total traded amount
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8" data-testid="card-tax-summary">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-500" />
              GE Tax Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Tax Paid</p>
                <p className="text-2xl font-bold font-mono text-yellow-500" data-testid="text-total-tax-paid">
                  {formatPrice(stats.totalTaxPaid)} gp
                </p>
                <p className="text-xs text-muted-foreground">2% of sell value (capped at 5M per trade)</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gross Revenue</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-gross-revenue">
                  {formatPrice(stats.totalGrossRevenue)} gp
                </p>
                <p className="text-xs text-muted-foreground">Total sell value before tax</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Net Revenue</p>
                <p className="text-2xl font-bold font-mono text-success" data-testid="text-net-revenue">
                  {formatPrice(stats.totalGrossRevenue - stats.totalTaxPaid)} gp
                </p>
                <p className="text-xs text-muted-foreground">Revenue after tax deduction</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>RS3 GE Tax:</strong> 2% of the sell price per item is deducted as Grand Exchange tax (floored). 
                Items sold for 49 gp or less are exempt. Bonds are also exempt.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card data-testid="card-best-flip">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Best Flip</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {stats.bestFlip ? (
                <div className="flex items-center gap-3">
                  {stats.bestFlip.itemIcon && (
                    <img src={stats.bestFlip.itemIcon} alt="" className="h-10 w-10 object-contain" />
                  )}
                  <div>
                    <div className="font-medium">{stats.bestFlip.itemName}</div>
                    <div className="text-success font-mono text-lg">
                      +{formatPrice(calculateProfit(stats.bestFlip) ?? 0)} gp
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ROI: {(calculateROI(stats.bestFlip) ?? 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No completed flips yet</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-worst-flip">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Worst Flip</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {stats.worstFlip && (calculateProfit(stats.worstFlip) ?? 0) < 0 ? (
                <div className="flex items-center gap-3">
                  {stats.worstFlip.itemIcon && (
                    <img src={stats.worstFlip.itemIcon} alt="" className="h-10 w-10 object-contain" />
                  )}
                  <div>
                    <div className="font-medium">{stats.worstFlip.itemName}</div>
                    <div className="text-destructive font-mono text-lg">
                      {formatPrice(calculateProfit(stats.worstFlip) ?? 0)} gp
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ROI: {(calculateROI(stats.worstFlip) ?? 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No losing flips (great job!)</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card data-testid="chart-profit-over-time">
            <CardHeader className="pb-4">
              <CardTitle>Profit Over Time (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitByDay}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(140 70% 50%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(140 70% 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatPrice(v)}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${formatPrice(value)} gp`, "Profit"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="hsl(140 70% 50%)" 
                      fill="url(#profitGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-roi-distribution">
            <CardHeader className="pb-4">
              <CardTitle>ROI Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roiDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      label={({ range, count }) => `${range}: ${count}`}
                    >
                      {roiDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [
                        `${value} flips`,
                        "Count"
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="chart-performance-by-strategy">
          <CardHeader className="pb-4">
            <CardTitle>Performance by Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            {performanceByStrategy.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No completed flips yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Strategy</th>
                      <th className="text-right py-2 px-2 font-medium">Total Profit</th>
                      <th className="text-right py-2 px-2 font-medium">Avg ROI</th>
                      <th className="text-right py-2 px-2 font-medium">Win Rate</th>
                      <th className="text-right py-2 px-2 font-medium">Avg Hold Time</th>
                      <th className="text-right py-2 px-2 font-medium">Flips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceByStrategy.map((row) => (
                      <tr key={row.strategy} className="border-b hover-elevate">
                        <td className="py-2 px-2">{row.strategy}</td>
                        <td className={`text-right py-2 px-2 font-mono ${row.totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {row.totalProfit >= 0 ? "+" : ""}{formatPrice(row.totalProfit)} gp
                        </td>
                        <td className="text-right py-2 px-2 font-mono">{row.avgROI.toFixed(2)}%</td>
                        <td className="text-right py-2 px-2 font-mono">{row.winRate.toFixed(1)}%</td>
                        <td className="text-right py-2 px-2 font-mono">{row.avgHoldTime} days</td>
                        <td className="text-right py-2 px-2">{row.flipsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-8">
          <ItemLeaderboard />
        </div>

        <Card data-testid="chart-top-items">
          <CardHeader className="pb-4">
            <CardTitle>Top Items by Profit</CardTitle>
          </CardHeader>
          <CardContent>
            {itemProfitRanking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No completed flips yet
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemProfitRanking} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatPrice(v)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${formatPrice(value)} gp`, "Profit"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar 
                      dataKey="profit" 
                      fill="hsl(140 70% 50%)" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
