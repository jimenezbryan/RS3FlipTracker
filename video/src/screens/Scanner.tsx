import React from "react";
import { Img, staticFile } from "remotion";
import {
  Bell, Download, Settings, BarChart3, TrendingUp, TrendingDown, Target, Zap, Clock, ListFilter, Filter,
  ChevronRight, ChevronDown, Star, Minus, ShieldCheck, ArrowUpDown, Briefcase, AlertTriangle, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGPExact } from "@/lib/formatters";
import { calculateTaxPerItem } from "@shared/taxCalculator";
import { calculateObservableRange, calculateTechnicalIndicators } from "../../../server/technical-indicators";
import { PriceChart } from "../ui/PriceChart";
import { SCANNER_ROWS, SCYTHE_HISTORY, SCYTHE_ID, type ScannerRow } from "../data/items";

// Replica of client/src/pages/Scanner.tsx (compact view). Class names are copied from the page.
// Four columns are left out so the table fits the frame: LIMIT, TYPE, FILLABLE and AI EST. %,
// and cells use px-3 instead of the table's default px-4.

const TOTAL_ITEMS = 7073; // size of shared/itemCategories.json
const SIGNAL_COUNT = 412; // illustrative

const SIGNAL_STYLES: Record<string, string> = {
  "Smart Money": "bg-amber-500/20 text-amber-600 border-amber-500/30",
  "Deep Value": "bg-emerald-500/20 text-green-500 border-emerald-500/30",
  Accumulation: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  "Strong Trend": "bg-green-500/20 text-green-500 border-green-500/30",
  "Good Value": "bg-teal-500/20 text-teal-600 border-teal-500/30",
  Pullback: "bg-blue-500/20 text-blue-600 border-blue-500/30",
};

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className={`h-5 w-5 ${accent}`} />
      </div>
    </div>
  );
}

function TrendArrow({ trend }: { trend: ScannerRow["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 shrink-0 text-green-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />;
  return <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function Sparkline({ trend, price }: { trend: ScannerRow["trend"]; price: number }) {
  const volatility = price * 0.02;
  const data = Array.from({ length: 10 }, (_, i) => {
    const trendFactor = trend === "up" ? (i / 10) * volatility * 2 : trend === "down" ? -((i / 10) * volatility * 2) : 0;
    return price + trendFactor + (Math.sin(i * 1.5) + Math.cos(i * 0.7)) * volatility * 0.5;
  });
  const min = Math.min(...data), range = Math.max(...data) - min || 1;
  const d = data.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / 9) * 30} ${12 - ((p - min) / range) * 10}`).join(" ");
  return (
    <svg width="30" height="14" className="inline-block">
      <path d={d} fill="none" stroke={trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConfidenceBadge({ level }: { level: ScannerRow["confidence"] }) {
  const styles = {
    low: "bg-muted text-muted-foreground border-border",
    medium: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
    high: "bg-emerald-500/20 text-green-500 border-emerald-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${styles[level]}`}>
      <ShieldCheck className="h-3 w-3" />
      {level.toUpperCase()}
    </span>
  );
}

const Sort = () => <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
const HEADS: [string, string, boolean][] = [
  ["ITEM", "", true], ["SCORE", "text-center", true], ["TREND", "text-center w-12", false],
  ["BUY", "text-right", true], ["SELL", "text-right", true], ["SPREAD", "text-right", true],
  ["ROI %", "text-right", true], ["VOLUME", "text-right", true], ["NET PROFIT", "text-right", true],
  ["SIGNALS", "text-center", false],
];

function derive(item: ScannerRow) {
  const margin = item.sellPrice - item.buyPrice;
  const perItem = margin - calculateTaxPerItem(item.sellPrice, item.id, item.name);
  const fillQty = Math.min(item.geLimit, Math.floor(item.volume / 6));
  return { margin, roi: (perItem / item.buyPrice) * 100, fillQty, netProfit: perItem * fillQty };
}

function ItemDetailPanel() {
  const history = SCYTHE_HISTORY.map((p) => ({ date: new Date(p.timestamp).toISOString(), price: p.price, volume: p.volume }));
  const ind = calculateTechnicalIndicators(history);
  const range = calculateObservableRange(history, 30);
  const tile = "p-3 rounded-lg border border-border bg-muted/50";
  return (
    <div className="space-y-4">
      {range && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-green-500"><Eye className="h-4 w-4" />Observable Market Range</h4>
            <span className="text-xs text-muted-foreground">Based on actual recorded prices</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">30-Day Range</span>
              <span className="font-mono text-sm font-bold text-green-500">{range.spreadPct.toFixed(1)}% range</span>
            </div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{formatGPExact(range.low)}</span>
              <span className="font-mono">{formatGPExact(range.high)}</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-500/20" />
              <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow" style={{ left: `calc(${Math.max(0, Math.min(100, range.percentile))}% - ${range.percentile > 50 ? 12 : 0}px)` }} />
            </div>
            <div className="text-xs text-muted-foreground">Current: <span className="font-mono font-medium text-foreground">{formatGPExact(range.current)}</span></div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <div className={tile}>
          <p className="text-xs uppercase text-muted-foreground">RSI (14)</p>
          <p className={`text-lg font-bold ${ind.rsi14 == null ? "text-muted-foreground" : ind.rsi14 < 30 ? "text-green-500" : ind.rsi14 > 70 ? "text-red-500" : "text-primary"}`}>{ind.rsi14?.toFixed(1) ?? "N/A"}</p>
          <p className="text-xs text-muted-foreground">{ind.rsi14 == null ? "" : ind.rsi14 < 30 ? "Oversold" : ind.rsi14 > 70 ? "Overbought" : "Neutral"}</p>
        </div>
        <div className={tile}>
          <p className="text-xs uppercase text-muted-foreground">Average Trend</p>
          <p className={`text-lg font-bold ${ind.smaCrossover === "bullish" ? "text-green-500" : ind.smaCrossover === "bearish" ? "text-red-500" : "text-muted-foreground"}`}>
            {ind.smaCrossover === "bullish" ? "Bullish" : ind.smaCrossover === "bearish" ? "Bearish" : "Neutral"}
          </p>
          <p className="text-xs text-muted-foreground">7d vs 30d average</p>
        </div>
        <div className={tile}>
          <p className="text-xs uppercase text-muted-foreground">Volatility</p>
          <p className={`text-lg font-bold ${ind.volatilityPct == null ? "text-muted-foreground" : ind.volatilityPct > 5 ? "text-red-500" : ind.volatilityPct > 3 ? "text-yellow-600" : "text-green-500"}`}>
            {ind.volatilityPct != null ? `${ind.volatilityPct.toFixed(1)}%` : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground">{ind.volatilityPct == null ? "" : ind.volatilityPct > 5 ? "High Risk" : ind.volatilityPct > 3 ? "Moderate" : "Stable"}</p>
        </div>
        <div className={tile}>
          <p className="text-xs uppercase text-muted-foreground">Price vs 30d avg</p>
          <p className={`text-lg font-bold ${ind.priceVsAvg30 == null ? "text-muted-foreground" : ind.priceVsAvg30 > 0 ? "text-green-500" : "text-red-500"}`}>
            {ind.priceVsAvg30 == null ? "N/A" : `${ind.priceVsAvg30 > 0 ? "+" : ""}${ind.priceVsAvg30.toFixed(2)}%`}
          </p>
          <p className="text-xs text-muted-foreground">30d: {ind.avg30d ? formatGPExact(ind.avg30d) : "N/A"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-primary"><Briefcase className="mr-2 h-4 w-4" />Add to Portfolio</Button>
        <Button variant="outline" className="border-yellow-500/50 text-yellow-600"><AlertTriangle className="mr-2 h-4 w-4" />Set Alert</Button>
      </div>
    </div>
  );
}

/** A table cell that can squash to nothing, so filtered-out rows collapse instead of popping. */
const C: React.FC<{ keep: number; className?: string; children?: React.ReactNode }> = ({ keep, className = "", children }) => (
  <TableCell className={`px-3 py-2 ${className}`} style={keep < 1 ? { paddingTop: 8 * keep, paddingBottom: 8 * keep } : undefined}>
    <div style={keep < 1 ? { maxHeight: 40 * keep, overflow: "hidden", opacity: keep } : undefined}>{children}</div>
  </TableCell>
);

export const ROW_H = 57;
export const EXPANDED_H = 596;

export const ScannerScreen: React.FC<{
  mainWidth: number;
  scrollY: number;
  signalsOnly: number; // 0..1 — rows without a signal collapse as this goes to 1
  checked: boolean;
  hoverRow: boolean; // cursor over the scythe row
  expand: number; // 0..1 height of the expanded detail row
  chartReveal: number;
  hoverIndex: number | null;
  zonePulse: number;
}> = ({ mainWidth, scrollY, signalsOnly, checked, hoverRow, expand, chartReveal, hoverIndex, zonePulse }) => {
  const shown = checked ? SIGNAL_COUNT : TOTAL_ITEMS;
  const chartCol = (mainWidth - 48 - 2 - 32 - 2 - 16) / 2;
  return (
    <div className="absolute inset-x-0 top-0 bg-background p-6" style={{ transform: `translateY(${-scrollY}px)` }}>
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">RS3 Trading Terminal</h1>
            <p className="text-sm text-muted-foreground">Advanced Market Intelligence Platform</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border"><Bell className="mr-2 h-4 w-4" />Alerts</Button>
            <Button variant="outline" size="sm" className="border-border"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button variant="outline" size="icon" className="border-border"><Settings className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-5 gap-4">
        <StatCard label="Total Items" value={TOTAL_ITEMS.toLocaleString()} icon={BarChart3} accent="text-primary" />
        <StatCard label="Trade Signals" value={286} icon={TrendingUp} accent="text-purple-600" />
        <StatCard label="Opportunities" value={SIGNAL_COUNT} icon={Target} accent="text-green-500" />
        <StatCard label="Avg Score" value={46} icon={Zap} accent="text-yellow-600" />
        <StatCard label="Last Updated" value="2m ago" icon={Clock} accent="text-primary" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card/50 p-4">
        <div className="min-w-[200px] max-w-md flex-1">
          <Input placeholder={`Search items... (${TOTAL_ITEMS} available)`} readOnly className="border-border bg-muted/50" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox className="border-border" />
          <Label className="text-sm text-muted-foreground">F2P Only</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox className="border-border" />
          <Label className="flex items-center gap-1 text-sm text-muted-foreground">
            <ListFilter className="h-3 w-3" />Watchlist Only
            <Badge variant="outline" className="ml-1 border-yellow-500/50 text-xs text-yellow-600">6</Badge>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox className="border-border" checked={checked} />
          <Label className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="h-3 w-3" />Show Signals Only
            <Badge variant="outline" className="ml-1 border-emerald-500/50 text-xs text-green-500">{SIGNAL_COUNT}</Badge>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox className="border-border" />
          <Label className="flex items-center gap-1 text-sm text-muted-foreground">
            <Target className="h-3 w-3" />High Score Only
            <Badge variant="outline" className="ml-1 border-primary/50 text-xs text-primary">286</Badge>
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2"><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          {shown.toLocaleString()} items
        </div>
      </div>

      <div className="mb-4 rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Button variant="ghost" size="sm" className="gap-2"><Filter className="h-4 w-4" />Filters<ChevronRight className="h-4 w-4" /></Button>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-sm tabular-nums">{shown.toLocaleString()}<span className="text-muted-foreground"> of {TOTAL_ITEMS.toLocaleString()}</span></span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8" /><TableHead className="w-10" /><TableHead className="w-12" />
              {HEADS.map(([label, cls, sortable]) => (
                <TableHead key={label} className={`whitespace-nowrap px-3 text-muted-foreground ${cls}`}>{label}{sortable && <Sort />}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCANNER_ROWS.map((item) => {
              const d = derive(item);
              const isScythe = item.id === SCYTHE_ID;
              const isExpanded = isScythe && expand > 0;
              const keep = item.signals.length > 0 ? 1 : 1 - signalsOnly;
              if (keep <= 0.001) return null;
              return (
                <React.Fragment key={item.id}>
                  <TableRow
                    className={`border-border ${isExpanded ? "bg-muted/30" : ""}`}
                    style={isScythe && hoverRow && !isExpanded ? { background: "rgba(16,185,129,0.05)", boxShadow: "0 0 20px rgba(16,185,129,0.1)" } : undefined}
                  >
                    <C keep={keep}>{isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</C>
                    <C keep={keep}><div className="flex h-8 w-8 items-center justify-center"><Star className="h-4 w-4 text-muted-foreground" /></div></C>
                    <C keep={keep}><Img src={staticFile(`icons/${item.id}.gif`)} className="h-8 w-8 object-contain" /></C>
                    <C keep={keep} className="font-medium">
                      <div className="flex items-center gap-2">
                        <TrendArrow trend={item.trend} />
                        <div className="min-w-0">
                          <span className="block max-w-[200px] truncate">{item.name}</span>
                          <span className="block max-w-[200px] truncate text-xs font-normal text-muted-foreground">{item.category}</span>
                        </div>
                      </div>
                    </C>
                    <C keep={keep} className="text-center">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        item.tradeScore >= 80 ? "bg-emerald-500/20 border-emerald-500/50 text-green-500"
                          : item.tradeScore >= 60 ? "bg-primary/15 border-primary/50 text-primary"
                            : item.tradeScore >= 40 ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-600"
                              : "bg-red-500/20 border-red-500/50 text-red-500"}`}>
                        {item.tradeScore}
                      </div>
                    </C>
                    <C keep={keep} className="text-center"><Sparkline trend={item.trend} price={item.buyPrice} /></C>
                    <C keep={keep} className="whitespace-nowrap text-right font-mono text-sm tabular-nums">{formatGPExact(item.buyPrice)}</C>
                    <C keep={keep} className="whitespace-nowrap text-right font-mono text-sm tabular-nums">{formatGPExact(item.sellPrice)}</C>
                    <C keep={keep} className="whitespace-nowrap text-right font-mono text-sm font-medium tabular-nums text-green-500">{formatGPExact(d.margin)}</C>
                    <C keep={keep} className={`text-right font-medium ${d.roi > 5 ? "text-green-500" : d.roi > 0 ? "text-yellow-600" : "text-red-500"}`}>{d.roi.toFixed(1)}%</C>
                    <C keep={keep} className="text-right text-muted-foreground">{item.volume.toLocaleString()}</C>
                    <C keep={keep} className={`whitespace-nowrap text-right font-mono font-bold tabular-nums ${d.netProfit > 0 ? "text-green-500" : "text-red-500"}`}>{formatGPExact(d.netProfit)}</C>
                    <C keep={keep}>
                      <div className="flex flex-wrap justify-center gap-1">
                        {item.signals.map((signal) => (
                          <Badge key={signal} variant="outline" className={`whitespace-nowrap text-xs ${SIGNAL_STYLES[signal]}`}>{signal}</Badge>
                        ))}
                      </div>
                    </C>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="border-border bg-card/80 hover:bg-card/80">
                      <TableCell colSpan={13} className="p-0">
                        <div style={{ height: EXPANDED_H * expand, overflow: "hidden", opacity: Math.min(1, expand * 1.5) }}>
                          <div className="space-y-4 border-l-2 border-primary/50 p-4" style={{ width: mainWidth - 50 }}>
                            <div className="grid grid-cols-2 gap-4">
                              <div><PriceChart itemName={item.name} history={SCYTHE_HISTORY} width={chartCol - 50} reveal={chartReveal} hoverIndex={hoverIndex} zoneBadgePulse={zonePulse} /></div>
                              <ItemDetailPanel />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
