import React, { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculatePriceZones, movingAverage, ZONE_LABELS, type Zone } from "@shared/priceZones";
import type { HistoryPoint } from "../data/items";

// Replica of client/src/components/PriceHistoryChart.tsx on the 90D tab. Zones and the moving
// average come from the app's own shared/priceZones.ts, fed with the real WeirdGloop history.

const ZONE_BADGE_CLASS: Record<Zone, string> = {
  buy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  sell: "bg-red-500/10 text-red-400 border-red-500/30",
  accumulation: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  neutral: "bg-muted text-muted-foreground border-transparent",
};
const PERIODS = ["24H", "7D", "90D", "6M", "1Y", "ALL"];
const full = (n: number) => Math.round(n).toLocaleString();
const short = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (ts: number) => { const d = new Date(ts); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export const CHART_H = 240;
const Y_AXIS = 50, TOP = 10, RIGHT = 10, X_AXIS = 24, BRUSH = 22;

export const PriceChart: React.FC<{
  itemName: string;
  history: HistoryPoint[];
  width: number; // px available to the plot, measured by the parent layout
  reveal: number; // 0..1 how much of the line is drawn
  hoverIndex?: number | null; // data index under the cursor (tooltip)
  zoneBadgePulse?: number; // 0..1 emphasis on the zone badge
}> = ({ itemName, history, width, reveal, hoverIndex = null, zoneBadgePulse = 0 }) => {
  const m = useMemo(() => {
    const prices = history.map((p) => p.price);
    const zones = calculatePriceZones(history)!;
    const ma = movingAverage(prices, 7);
    const lo = Math.min(...prices), hi = Math.max(...prices), pad = (hi - lo) * 0.08;
    const yMin = lo - pad, yMax = hi + pad;
    const t0 = history[0].timestamp, t1 = history[history.length - 1].timestamp;
    const last30 = prices.slice(-30), last7 = prices.slice(-7);
    return { prices, zones, ma, yMin, yMax, t0, t1, last30, last7, change: (prices[prices.length - 1] / prices[0] - 1) * 100 };
  }, [history]);

  const plotW = width - Y_AXIS - RIGHT, plotH = CHART_H - TOP - X_AXIS - BRUSH;
  const x = (ts: number) => Y_AXIS + ((ts - m.t0) / (m.t1 - m.t0)) * plotW;
  const y = (p: number) => TOP + (1 - (p - m.yMin) / (m.yMax - m.yMin)) * plotH;
  const line = history.map((p, i) => `${i ? "L" : "M"}${x(p.timestamp).toFixed(1)},${y(p.price).toFixed(1)}`).join("");
  const area = `${line}L${x(m.t1)},${TOP + plotH}L${x(m.t0)},${TOP + plotH}Z`;
  const maLine = m.ma.map((v, i) => (v == null ? "" : `${m.ma[i - 1] == null ? "M" : "L"}${x(history[i].timestamp).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const yTicks = [0, 1, 2, 3, 4].map((i) => m.yMin + ((m.yMax - m.yMin) * i) / 4);
  const xTicks = [0, 1, 2, 3, 4, 5].map((i) => m.t0 + ((m.t1 - m.t0) * i) / 5);
  const hover = hoverIndex == null ? null : history[hoverIndex];
  const TrendIcon = m.change > 0.5 ? TrendingUp : m.change < -0.5 ? TrendingDown : Minus;
  const trendColor = m.change > 0.5 ? "text-success" : m.change < -0.5 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{itemName}</CardTitle>
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`font-mono text-sm ${trendColor}`}>{m.change >= 0 ? "+" : ""}{m.change.toFixed(1)}%</span>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ZONE_BADGE_CLASS[m.zones.zone]}`}
              style={{ boxShadow: `0 0 0 ${3 * zoneBadgePulse}px rgba(52,211,153,${0.35 * zoneBadgePulse})`, transform: `scale(${1 + 0.12 * zoneBadgePulse})` }}
            >
              {ZONE_LABELS[m.zones.zone]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <Button key={p} variant={p === "90D" ? "default" : "ghost"} size="sm" className={p === "90D" ? "bg-cyan-600 text-white" : "text-muted-foreground"}>
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative w-full" style={{ height: CHART_H }}>
          <svg width={width} height={CHART_H} className="absolute left-0 top-0 overflow-visible text-xs">
            <defs>
              <linearGradient id="price-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <clipPath id="price-reveal"><rect x={Y_AXIS} y={0} width={plotW * reveal} height={CHART_H} /></clipPath>
            </defs>
            {yTicks.map((v, i) => <line key={i} x1={Y_AXIS} x2={Y_AXIS + plotW} y1={y(v)} y2={y(v)} stroke="hsl(var(--muted))" strokeDasharray="3 3" />)}
            {xTicks.map((ts, i) => <line key={i} y1={TOP} y2={TOP + plotH} x1={x(ts)} x2={x(ts)} stroke="hsl(var(--muted))" strokeDasharray="3 3" />)}
            {/* zone bands: bottom 25%, middle, top 25% */}
            <rect x={Y_AXIS} width={plotW} y={y(m.zones.buyMax)} height={TOP + plotH - y(m.zones.buyMax)} fill="#22c55e" fillOpacity={0.1} />
            <rect x={Y_AXIS} width={plotW} y={y(m.zones.sellMin)} height={y(m.zones.buyMax) - y(m.zones.sellMin)} fill={m.zones.accumulating ? "#f59e0b" : "#94a3b8"} fillOpacity={m.zones.accumulating ? 0.12 : 0.04} />
            <rect x={Y_AXIS} width={plotW} y={TOP} height={y(m.zones.sellMin) - TOP} fill="#ef4444" fillOpacity={0.1} />
            {yTicks.map((v, i) => <text key={i} x={Y_AXIS - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{short(v)}</text>)}
            {xTicks.map((ts, i) => <text key={i} x={x(ts)} y={TOP + plotH + 15} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{day(ts)}</text>)}
            <g clipPath="url(#price-reveal)">
              <path d={area} fill="url(#price-gradient)" />
              <path d={line} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={2} strokeLinejoin="round" />
              <path d={maLine} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" />
            </g>
            {hover && (
              <g>
                <line x1={x(hover.timestamp)} x2={x(hover.timestamp)} y1={TOP} y2={TOP + plotH} stroke="hsl(var(--border))" />
                <circle cx={x(hover.timestamp)} cy={y(hover.price)} r={4} fill="hsl(var(--chart-1))" stroke="hsl(var(--background))" strokeWidth={2} />
              </g>
            )}
            {/* brush */}
            <rect x={Y_AXIS} y={CHART_H - BRUSH} width={plotW} height={BRUSH} fill="transparent" stroke="hsl(var(--muted-foreground))" />
            <rect x={Y_AXIS} y={CHART_H - BRUSH} width={8} height={BRUSH} fill="hsl(var(--muted-foreground))" />
            <rect x={Y_AXIS + plotW - 8} y={CHART_H - BRUSH} width={8} height={BRUSH} fill="hsl(var(--muted-foreground))" />
            <text x={Y_AXIS - 6} y={CHART_H - 7} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">{day(m.t0)}</text>
          </svg>
          {hover && (
            <div
              className="absolute grid min-w-[8rem] gap-1.5 whitespace-nowrap rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
              style={{ left: x(hover.timestamp) - 200, top: y(hover.price) - 78 }}
            >
              <div className="font-medium">{day(hover.timestamp)}, {new Date(hover.timestamp).getUTCFullYear()}</div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "hsl(var(--chart-1))" }} />
                <span className="text-muted-foreground">GE Price</span>
                <span className="ml-auto font-mono font-medium tabular-nums">{full(hover.price)} gp</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-0 w-4 border-t border-dashed border-muted-foreground" />
            <span>7d avg</span>
          </div>
          <span className="text-muted-foreground/70">|</span>
          <span className="text-emerald-400">Bottom 25% &le; {full(m.zones.buyMax)}</span>
          <span className="text-red-400">Top 25% &ge; {full(m.zones.sellMin)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">90D change</span>
          <span className={`font-mono font-medium ${m.change > 0 ? "text-success" : "text-destructive"}`}>{m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%</span>
          <span className="text-muted-foreground">{full(m.prices[0])} &rarr; {full(m.prices[m.prices.length - 1])} gp</span>
          <span className="text-muted-foreground/70">({m.prices.length} points)</span>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="space-y-1"><div className="text-muted-foreground">7-Day Avg</div><div className="font-mono font-medium">{full(avg(m.last7))} gp</div></div>
          <div className="space-y-1"><div className="text-muted-foreground">30-Day Avg</div><div className="font-mono font-medium">{full(avg(m.last30))} gp</div></div>
          <div className="space-y-1"><div className="text-muted-foreground">30-Day Low</div><div className="font-mono font-medium text-success">{full(Math.min(...m.last30))} gp</div></div>
          <div className="space-y-1"><div className="text-muted-foreground">30-Day High</div><div className="font-mono font-medium text-destructive">{full(Math.max(...m.last30))} gp</div></div>
        </div>
      </CardContent>
    </Card>
  );
};

/** x offset (inside the chart card's plot) of a data index, so the cursor can point at it. */
export const chartPointX = (history: HistoryPoint[], index: number, width: number) => {
  const t0 = history[0].timestamp, t1 = history[history.length - 1].timestamp;
  return Y_AXIS + ((history[index].timestamp - t0) / (t1 - t0)) * (width - Y_AXIS - RIGHT);
};
