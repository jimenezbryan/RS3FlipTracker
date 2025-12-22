import type { PortfolioSnapshot } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface PortfolioValueChartProps {
  snapshots: PortfolioSnapshot[];
  isLoading?: boolean;
  onCreateSnapshot: () => void;
  isCreatingSnapshot: boolean;
}

export function PortfolioValueChart({ snapshots = [], isLoading = false, onCreateSnapshot, isCreatingSnapshot }: PortfolioValueChartProps) {

  const formatPrice = (price: number) => {
    if (price >= 1000000000) return `${(price / 1000000000).toFixed(1)}B`;
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(1)}K`;
    return price.toLocaleString();
  };

  const chartData = snapshots
    .slice()
    .reverse()
    .map((snapshot) => ({
      date: format(new Date(snapshot.snapshotDate), "MMM d"),
      fullDate: format(new Date(snapshot.snapshotDate), "PPpp"),
      value: snapshot.totalValue,
      cost: snapshot.totalCost,
      profit: snapshot.totalProfit,
    }));

  const latestSnapshot = snapshots[0];
  const previousSnapshot = snapshots[1];

  let valueChange = 0;
  let valueChangePercent = 0;
  if (latestSnapshot && previousSnapshot) {
    valueChange = latestSnapshot.totalValue - previousSnapshot.totalValue;
    valueChangePercent = previousSnapshot.totalValue > 0 
      ? ((latestSnapshot.totalValue - previousSnapshot.totalValue) / previousSnapshot.totalValue) * 100 
      : 0;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Value</CardTitle>
          <CardDescription>Track your investment growth over time</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No snapshots yet</h3>
          <p className="mb-4 text-sm text-muted-foreground max-w-sm">
            Create snapshots to track how your portfolio value changes over time. 
            Each snapshot records the current value of all your holdings.
          </p>
          <Button 
            onClick={onCreateSnapshot} 
            disabled={isCreatingSnapshot}
            data-testid="button-create-first-snapshot"
          >
            Create First Snapshot
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="text-lg">Portfolio Value</CardTitle>
          <CardDescription>
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded
          </CardDescription>
        </div>
        {latestSnapshot && (
          <div className="text-right">
            <div className="font-mono text-2xl font-bold" data-testid="text-chart-current-value">
              {formatPrice(latestSnapshot.totalValue)} gp
            </div>
            {previousSnapshot && (
              <div className={`flex items-center justify-end gap-1 text-sm ${
                valueChange >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                {valueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>
                  {valueChange >= 0 ? "+" : ""}{formatPrice(valueChange)} ({valueChangePercent >= 0 ? "+" : ""}{valueChangePercent.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-72" data-testid="chart-portfolio-value">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210, 90%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210, 90%, 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(220, 10%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(220, 10%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(145, 65%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(145, 65%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={(value) => formatPrice(value)}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                width={60}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-popover p-3 shadow-lg">
                        <div className="text-xs text-muted-foreground mb-2">{data.fullDate}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Value:</span>
                            <span className="font-mono font-medium">{formatPrice(data.value)} gp</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Cost:</span>
                            <span className="font-mono font-medium">{formatPrice(data.cost)} gp</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Profit:</span>
                            <span className={`font-mono font-medium ${data.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {data.profit >= 0 ? "+" : ""}{formatPrice(data.profit)} gp
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="value" 
                name="Value"
                stroke="hsl(210, 90%, 55%)" 
                fill="url(#valueGradient)"
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="cost" 
                name="Cost"
                stroke="hsl(220, 10%, 50%)" 
                fill="url(#costGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
