import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Star, ChevronUp, ChevronDown, Filter, ChevronRight, 
  TrendingUp, TrendingDown, Minus, Bell, Download, Settings,
  BarChart3, Zap, Target, Clock, Plus, Eye, AlertTriangle,
  Briefcase, ListFilter, Flame, ShieldCheck, History, ArrowUpDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatGP } from "@/lib/formatters";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";

interface ScannerItem {
  id: number;
  name: string;
  icon: string;
  isMembers: boolean;
  geLimit: number;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  volume: number;
  potentialProfit: number;
  marginVolume: number;
  roi: number;
  netProfit: number;
  capitalEfficiency: number;
  trend: "up" | "down" | "stable";
  changePct24h: number | null;
  volatility: "low" | "medium" | "high";
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  suggestedMarginPct: number;
  priceTier: "low" | "mid" | "high" | "ultra";
  confidence: "low" | "medium" | "high";
  range7dLow: number | null;
  range7dHigh: number | null;
  range7dSpreadPct: number | null;
}

interface ValueGapAnalysis {
  fairValue: number;
  currentPrice: number;
  gapPct: number;
  gapDirection: "undervalued" | "overvalued" | "fair";
  signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
}

interface TechnicalIndicators {
  rsi14: number | null;
  sma7: number | null;
  sma30: number | null;
  sma200: number | null;
  smaCrossover: "bullish" | "bearish" | "neutral";
  volatilityPct: number;
  priceVsAvg30: number;
  support: number | null;
  resistance: number | null;
  valueGap: ValueGapAnalysis | null;
}

interface TradeHistoryStats {
  tradeCount: number;
  avgActualMarginPct: number;
  avgActualROI: number;
  avgHoldTimeHours: number;
  winRate: number;
  lastTradeDate: string | null;
  modelGap: number;
}

interface ObservableRange {
  low: number;
  high: number;
  current: number;
  spreadPct: number;
  percentile: number;
}

interface ItemDetail {
  itemId: number;
  indicators: TechnicalIndicators | null;
  tradeStats: TradeHistoryStats;
  range7d: ObservableRange | null;
  range30d: ObservableRange | null;
}

interface ProcessedScannerItem extends ScannerItem {
  volumeRatio: number;
  volumeScore: number;
  momentumScore: number;
  valueScore: number;
  riskScore: number;
  riskRewardRatio: number;
  tradeScore: number;
  signals: string[];
}

const SIGNAL_PRIORITY: Record<string, number> = {
  "Smart Money": 1,
  "Deep Value": 1,
  "Accumulation": 2,
  "Strong Trend": 2,
  "Good Value": 3,
  "Distribution": 3,
  "Pullback": 2,
};

// ponytail: every one of these used to be compared against a margin the server hardcoded to
// 1% of price, so the margin-gated conditions effectively never fired and the ones that did
// fired on volume alone. With real spreads (median ~7%) the same thresholds fired on 93% of
// items, which is why "signals only" filtered almost nothing. Recalibrated against the live
// distribution: each marks roughly the top quartile-to-decile of its own axis.
// Tighten these to make the scanner pickier — they are the only dial that matters here.
const SIGNAL_DEEP_VALUE_ROI = 30;   // post-tax ROI %, ~p90
const SIGNAL_GOOD_VALUE_ROI = 15;   // post-tax ROI %, ~p75
const SIGNAL_MIN_MOVE_PCT = 10;     // |24h move| %, ~p75

const SIGNAL_STYLES: Record<string, string> = {
  "Smart Money": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Deep Value": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Favorable R/R": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Accumulation": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Oversold": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Overbought": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Strong Trend": "bg-green-500/20 text-green-400 border-green-500/30",
  "Good Value": "bg-teal-500/20 text-teal-400 border-teal-500/30",
  "High Reward": "bg-lime-500/20 text-lime-400 border-lime-500/30",
  "Distribution": "bg-red-500/20 text-red-400 border-red-500/30",
};

interface Favorite {
  id: string;
  itemId: number;
  itemName: string;
  itemIcon?: string;
}

interface PortfolioCategory {
  id: string;
  name: string;
  color?: string;
}

type SortKey = keyof ScannerItem | "tradeScore" | "volumeScore" | "momentumScore" | "valueScore" | "riskScore" | "suggestedMarginPct";
type SortDirection = "asc" | "desc";
type ViewMode = "compact" | "standard" | "detailed";

const BUY_LIMIT_OPTIONS = [1, 2, 5, 10, 100, 1000, 5000, 10000];

const PRICE_RANGE_OPTIONS = [
  { label: "Under 1K", min: 0, max: 999 },
  { label: "1K-10K", min: 1000, max: 9999 },
  { label: "10K-100K", min: 10000, max: 99999 },
  { label: "100K-1M", min: 100000, max: 999999 },
  { label: "1M-10M", min: 1000000, max: 9999999 },
  { label: "10M+", min: 10000000, max: Infinity },
];

const ITEMS_PER_PAGE = 50;

const ALERT_TYPES = [
  { value: "price_above", label: "Price Above" },
  { value: "price_below", label: "Price Below" },
  { value: "margin_above", label: "Margin Above" },
  { value: "margin_below", label: "Margin Below" },
];

function Sparkline({ trend, price }: { trend: "up" | "down" | "stable"; price: number }) {
  const points = useMemo(() => {
    const data: number[] = [];
    const basePrice = price;
    const volatility = basePrice * 0.02;
    
    for (let i = 0; i < 10; i++) {
      let trendFactor = 0;
      if (trend === "up") {
        trendFactor = (i / 10) * volatility * 2;
      } else if (trend === "down") {
        trendFactor = -((i / 10) * volatility * 2);
      }
      const noise = (Math.sin(i * 1.5) + Math.cos(i * 0.7)) * volatility * 0.5;
      data.push(basePrice + trendFactor + noise);
    }
    return data;
  }, [trend, price]);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  
  const pathD = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 30;
    const y = 12 - ((p - min) / range) * 10;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const color = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280";

  return (
    <svg width="30" height="14" className="inline-block">
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

function StatCard({ label, value, icon: Icon, accent = "cyan" }: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType;
  accent?: "cyan" | "green" | "purple" | "yellow";
}) {
  const accentColors = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400",
    green: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400",
    yellow: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-gradient-to-br ${accentColors[accent]} backdrop-blur-sm p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-60" />
      </div>
      <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-current opacity-5" />
    </div>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function VolatilityBadge({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

function PulsingDot({ active }: { active: boolean }) {
  return (
    <span className={`relative flex h-2 w-2 ${active ? "" : "opacity-30"}`}>
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? "bg-emerald-500" : "bg-slate-500"}`} />
    </span>
  );
}

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const styles = {
    low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const icons = { low: "?", medium: "~", high: "+" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border inline-flex items-center gap-1 ${styles[level]}`}>
      <ShieldCheck className="h-3 w-3" />
      {level.toUpperCase()}
    </span>
  );
}

function PriceTierBadge({ tier }: { tier: "low" | "mid" | "high" | "ultra" }) {
  const styles = {
    low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    mid: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    high: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    ultra: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  const labels = { low: "<1K", mid: "1K-1M", high: "1M-100M", ultra: "100M+" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${styles[tier]}`}>
      {labels[tier]}
    </span>
  );
}

function ModelGapIndicator({ gap, tradeCount }: { gap: number; tradeCount: number }) {
  if (tradeCount === 0) return null;
  const color = gap > 0 ? "text-emerald-400" : gap < 0 ? "text-red-400" : "text-muted-foreground";
  const label = gap > 0 ? "Outperforming" : gap < 0 ? "Underperforming" : "On Track";
  return (
    <div className="flex items-center gap-1">
      <ArrowUpDown className={`h-3 w-3 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>
        {gap > 0 ? "+" : ""}{gap.toFixed(2)}% ({label})
      </span>
    </div>
  );
}

function PriceRangeBar({ range, label }: { range: ObservableRange; label: string }) {
  const markerPosition = Math.max(0, Math.min(100, range.percentile));
  const spreadColor = range.spreadPct >= 10 ? "text-emerald-400" : range.spreadPct >= 5 ? "text-cyan-400" : range.spreadPct >= 2 ? "text-yellow-400" : "text-muted-foreground";
  const barColor = range.spreadPct >= 10 ? "from-emerald-500/60 to-emerald-500/20" : range.spreadPct >= 5 ? "from-cyan-500/60 to-cyan-500/20" : "from-yellow-500/60 to-yellow-500/20";

  return (
    <div className="space-y-2" data-testid={`range-bar-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-bold font-mono ${spreadColor}`}>{range.spreadPct.toFixed(1)}% range</span>
      </div>
      <div className="relative">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="font-mono">{formatGP(range.low)}</span>
          <span className="font-mono">{formatGP(range.high)}</span>
        </div>
        <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-r ${barColor} rounded-full`} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-900 shadow-lg shadow-white/20"
            style={{ left: `calc(${markerPosition}% - 6px)` }}
          />
        </div>
        <div className="flex items-center justify-center mt-1">
          <span className="text-xs text-muted-foreground">
            Current: <span className="font-mono font-medium text-foreground">{formatGP(range.current)}</span>
            <span className="ml-1 text-muted-foreground">({range.percentile}th percentile)</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ItemDetailPanel({ item, detail, isLoading }: { item: ScannerItem; detail: ItemDetail | undefined; isLoading: boolean }) {
  const ind = detail?.indicators;
  const stats = detail?.tradeStats;
  const range7d = detail?.range7d;
  const range30d = detail?.range30d;
  
  return (
    <div className="space-y-4">
      {(range7d || range30d) && (
        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5" data-testid="observable-range-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Observable Market Range
            </h4>
            <span className="text-xs text-muted-foreground">Based on actual recorded prices</span>
          </div>
          <div className={`grid ${range7d && range30d ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"} gap-4`}>
            {range7d && <PriceRangeBar range={range7d} label="7-Day Range" />}
            {range30d && <PriceRangeBar range={range30d} label="30-Day Range" />}
          </div>
          <p className="text-xs text-muted-foreground mt-3 border-t border-emerald-500/20 pt-2">
            {range7d && range7d.spreadPct >= 5
              ? `This item had a ${range7d.spreadPct.toFixed(1)}% price swing in the last 7 days. Traders who buy near the low and sell near the high can capture this range.`
              : range7d
                ? `Tight ${range7d.spreadPct.toFixed(1)}% range in 7 days. Margins are slim unless you trade high volume.`
                : "Insufficient data for 7-day range analysis."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ind ? (
          <>
            <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
              <p className="text-xs text-muted-foreground uppercase">RSI (14)</p>
              <p className={`text-lg font-bold ${
                ind.rsi14 !== null ? (ind.rsi14 < 30 ? "text-emerald-400" : ind.rsi14 > 70 ? "text-red-400" : "text-cyan-400") : "text-muted-foreground"
              }`}>
                {ind.rsi14 !== null ? ind.rsi14.toFixed(1) : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ind.rsi14 !== null ? (ind.rsi14 < 30 ? "Oversold" : ind.rsi14 > 70 ? "Overbought" : "Neutral") : ""}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
              <p className="text-xs text-muted-foreground uppercase">SMA Trend</p>
              <p className={`text-lg font-bold ${
                ind.smaCrossover === "bullish" ? "text-emerald-400" : ind.smaCrossover === "bearish" ? "text-red-400" : "text-muted-foreground"
              }`}>
                {ind.smaCrossover === "bullish" ? "Bullish" : ind.smaCrossover === "bearish" ? "Bearish" : "Neutral"}
              </p>
              <p className="text-xs text-muted-foreground">
                7: {ind.sma7 ? formatGP(ind.sma7) : "N/A"} | 30: {ind.sma30 ? formatGP(ind.sma30) : "N/A"} | 200: {ind.sma200 ? formatGP(ind.sma200) : "N/A"}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
              <p className="text-xs text-muted-foreground uppercase">Volatility</p>
              <p className={`text-lg font-bold ${
                ind.volatilityPct > 5 ? "text-red-400" : ind.volatilityPct > 3 ? "text-yellow-400" : "text-emerald-400"
              }`}>
                {ind.volatilityPct.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {ind.volatilityPct > 5 ? "High Risk" : ind.volatilityPct > 3 ? "Moderate" : "Stable"}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/50">
              <p className="text-xs text-muted-foreground uppercase">Support / Resistance</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-400">{ind.support ? formatGP(ind.support) : "N/A"}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm font-bold text-emerald-400">{ind.resistance ? formatGP(ind.resistance) : "N/A"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Price vs 30d avg: <span className={ind.priceVsAvg30 > 0 ? "text-emerald-400" : "text-red-400"}>
                  {ind.priceVsAvg30 > 0 ? "+" : ""}{ind.priceVsAvg30.toFixed(2)}%
                </span>
              </p>
            </div>
          </>
        ) : isLoading ? (
          <div className="col-span-4 flex items-center justify-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full mr-2" />
            <span className="text-sm text-muted-foreground">Loading technical indicators...</span>
          </div>
        ) : (
          <div className="col-span-4 text-center text-sm text-muted-foreground py-4">
            No price history available for technical analysis
          </div>
        )}
      </div>

      {ind?.valueGap && (
        <div className={`p-4 rounded-lg border ${
          ind.valueGap.gapDirection === "undervalued" ? "border-emerald-500/30 bg-emerald-500/5" 
          : ind.valueGap.gapDirection === "overvalued" ? "border-red-500/30 bg-red-500/5" 
          : "border-slate-700 bg-slate-800/50"
        }`} data-testid="value-gap-panel">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Value Gap Analysis
            </h4>
            <span className={`px-2 py-0.5 rounded text-xs border font-medium ${
              ind.valueGap.signal === "strong_buy" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : ind.valueGap.signal === "buy" ? "bg-green-500/20 text-green-400 border-green-500/30"
              : ind.valueGap.signal === "strong_sell" ? "bg-red-500/20 text-red-400 border-red-500/30"
              : ind.valueGap.signal === "sell" ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
              : "bg-slate-500/20 text-slate-400 border-slate-500/30"
            }`}>
              {ind.valueGap.signal.replace("_", " ").toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Fair Value</p>
              <p className="text-sm font-bold font-mono text-cyan-400">{formatGP(ind.valueGap.fairValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Price</p>
              <p className="text-sm font-bold font-mono">{formatGP(ind.valueGap.currentPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gap</p>
              <p className={`text-sm font-bold font-mono ${
                ind.valueGap.gapPct < 0 ? "text-emerald-400" : ind.valueGap.gapPct > 0 ? "text-red-400" : "text-muted-foreground"
              }`}>
                {ind.valueGap.gapPct > 0 ? "+" : ""}{ind.valueGap.gapPct.toFixed(2)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {ind.valueGap.gapDirection === "undervalued"
              ? `Trading ${Math.abs(ind.valueGap.gapPct).toFixed(1)}% below fair value (avg of SMA-30 & SMA-200). Potential buying opportunity.`
              : ind.valueGap.gapDirection === "overvalued"
                ? `Trading ${ind.valueGap.gapPct.toFixed(1)}% above fair value. Consider selling or waiting for a pullback.`
                : "Trading near fair value. Price is within expected range."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30" data-testid="ai-estimate-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              AI Estimate
              <span className="text-xs font-normal text-muted-foreground/60">(speculative)</span>
            </h4>
            <div className="flex items-center gap-2">
              <PriceTierBadge tier={item.priceTier} />
              <ConfidenceBadge level={stats && stats.tradeCount >= 10 ? "high" : stats && stats.tradeCount >= 3 ? "medium" : item.confidence} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Buy At</p>
              <p className="text-sm font-bold font-mono text-emerald-400/70">{formatGP(item.suggestedBuyPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sell At</p>
              <p className="text-sm font-bold font-mono text-red-400/70">{formatGP(item.suggestedSellPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target Margin</p>
              <p className="text-sm font-bold text-muted-foreground">{item.suggestedMarginPct.toFixed(2)}%</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2 border-t border-slate-700 pt-2">
            Model-based estimate. Use Observable Range above for data-backed spreads.
          </p>
        </div>

        {stats && stats.tradeCount > 0 ? (
          <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                <History className="h-4 w-4" />
                Your Trade History ({stats.tradeCount} trades)
              </h4>
              <ModelGapIndicator gap={stats.modelGap} tradeCount={stats.tradeCount} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Avg Margin</p>
                <p className={`text-sm font-bold ${stats.avgActualMarginPct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.avgActualMarginPct.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className={`text-sm font-bold ${stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.winRate.toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg ROI</p>
                <p className={`text-sm font-bold ${stats.avgActualROI > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.avgActualROI.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Hold</p>
                <p className="text-sm font-bold text-cyan-400">
                  {stats.avgHoldTimeHours < 24 ? `${stats.avgHoldTimeHours.toFixed(1)}h` : `${(stats.avgHoldTimeHours / 24).toFixed(1)}d`}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-purple-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Model Suggestion vs Your Actual</span>
                <span className={stats.modelGap > 0 ? "text-emerald-400" : stats.modelGap < 0 ? "text-red-400" : "text-muted-foreground"}>
                  {stats.modelGap > 0 
                    ? "You're beating the model - suggestion adjusted upward" 
                    : stats.modelGap < 0 
                      ? "Model suggests higher margins - consider wider spreads" 
                      : "Model aligned with your results"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <History className="h-4 w-4" />
              No Trade History
            </h4>
            <p className="text-xs text-muted-foreground">
              Trade this item to build history. The more you trade, the smarter the price suggestions become - your real results help calibrate the model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedItemCard({ item }: { item: ScannerItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:border-cyan-500/30 transition-colors">
      <img src={item.icon} alt={item.name} className="w-8 h-8 object-contain" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatGP(item.buyPrice)}</span>
          <span className={item.margin > 0 ? "text-emerald-400" : "text-red-400"}>
            {formatGP(item.margin)}
          </span>
        </div>
      </div>
      <TrendArrow trend={item.trend} />
    </div>
  );
}

export default function Scanner() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("netProfit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f2pOnly, setF2pOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [signalsOnly, setSignalsOnly] = useState(false);
  const [highScoreOnly, setHighScoreOnly] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScannerItem | null>(null);
  
  const [portfolioForm, setPortfolioForm] = useState({
    quantity: 1,
    buyPrice: 0,
    categoryId: "",
    notes: "",
  });
  
  const [alertForm, setAlertForm] = useState({
    alertType: "price_above",
    threshold: 0,
  });
  
  const [selectedBuyLimit, setSelectedBuyLimit] = useState<number | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    minMargin: "",
    maxMargin: "",
    minVolume: "",
    maxVolume: "",
    minPotentialProfit: "",
    maxPotentialProfit: "",
    minRoi: "",
    maxRoi: "",
  });

  const { data: items = [], isLoading, dataUpdatedAt } = useQuery<ScannerItem[]>({
    queryKey: ["/api/scanner/items"],
    refetchInterval: 60000,
  });

  const { data: favorites = [] } = useQuery<Favorite[]>({
    queryKey: ["/api/favorites"],
  });

  const { data: categories = [] } = useQuery<PortfolioCategory[]>({
    queryKey: ["/api/portfolio/categories"],
  });

  const { data: itemDetail, isLoading: isDetailLoading } = useQuery<ItemDetail>({
    queryKey: ["/api/scanner/item", expandedItemId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/scanner/item/${expandedItemId}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch item detail");
      return res.json();
    },
    enabled: !!expandedItemId,
    staleTime: 5 * 60 * 1000,
  });

  const addFavoriteMutation = useMutation({
    mutationFn: async (item: ScannerItem) => {
      return apiRequest("POST", "/api/favorites", {
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (favoriteId: string) => {
      return apiRequest("DELETE", `/api/favorites/${favoriteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const addPortfolioMutation = useMutation({
    mutationFn: async (data: {
      itemId: number;
      itemName: string;
      itemIcon: string;
      quantity: number;
      avgBuyPrice: number;
      totalCost: number;
      categoryId?: string;
      notes?: string;
    }) => {
      return apiRequest("POST", "/api/portfolio/holdings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
      setPortfolioDialogOpen(false);
      toast({
        title: "Added to Portfolio",
        description: `${selectedItem?.name} has been added to your portfolio.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to portfolio",
        variant: "destructive",
      });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: {
      itemId: number;
      itemName: string;
      itemIcon?: string;
      alertType: string;
      threshold: number;
    }) => {
      return apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setAlertDialogOpen(false);
      toast({
        title: "Alert Created",
        description: `Price alert for ${selectedItem?.name} has been set.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create alert",
        variant: "destructive",
      });
    },
  });

  const favoriteItemIds = useMemo(() => 
    new Set(favorites.map(f => f.itemId)),
    [favorites]
  );

  const processedItems = useMemo((): ProcessedScannerItem[] => {
    if (items.length === 0) return [];
    
    // Calculate global average volume ONCE as baseline
    const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);
    const globalAvgVolume = totalVolume / items.length;
    
    return items.map(item => {
      const marginPercent = item.buyPrice > 0 ? (item.margin / item.buyPrice) * 100 : 0;
      
      // 1. VOLUME ANALYSIS (Institutional Detection)
      const volumeRatio = globalAvgVolume > 0 ? item.volume / globalAvgVolume : 0;
      // Score: 0-100 based on how volume compares to average
      // 2x average = 100, 1x average = 50, 0.5x average = 25
      const volumeScore = Math.min(100, Math.round(volumeRatio * 50));
      
      // 2. MOMENTUM INDICATORS
      // Driven by the real 24h price direction. The RSI that used to weight this was
      // synthesised server-side from volume, so it carried no information the volume
      // score above didn't already have. Real RSI lives in the detail drawer.
      const momentumScore = item.trend === "up" ? 90 : item.trend === "stable" ? 55 : 20;
      
      // 3. VALUE METRICS
      let valueScore = 0;
      if (marginPercent > 5 || item.roi > 8) {
        valueScore = 100; // Deep Value
      } else if (marginPercent > 2 || item.roi > 4) {
        valueScore = 75; // Good Value
      } else if (marginPercent > 0) {
        valueScore = 50; // Fair Value
      } else {
        valueScore = Math.max(0, 30 + marginPercent * 5); // Negative margin
      }
      
      // 4. RISK/REWARD ANALYSIS
      // ponytail: reward and risk have to be the same unit. This compared potentialProfit —
      // margin across the whole buy limit — against a stop loss on a SINGLE unit, so the
      // ratio was inflated by roughly geLimit and "Favorable R/R" fired on 93% of items.
      // Per-unit margin against per-unit stop loss is the comparison that was intended.
      const stopLossAmount = item.buyPrice * 0.02; // 2% stop loss assumption, per unit
      const riskRewardRatio = stopLossAmount > 0 ? item.margin / stopLossAmount : 0;
      // R/R scoring: ratio > 3 = 100, ratio > 2 = 75, ratio > 1 = 50
      const riskScore = Math.min(100, Math.max(0, Math.round(riskRewardRatio * 25)));
      
      // 5. COMPOSITE TRADE SCORE (weighted average)
      const tradeScore = Math.round(
        volumeScore * 0.25 +      // 25% weight on volume
        momentumScore * 0.25 +    // 25% weight on momentum
        valueScore * 0.30 +       // 30% weight on value (most important)
        riskScore * 0.20          // 20% weight on risk/reward
      );
      
      // 6. SIGNAL GENERATION with priority system
      const signals: string[] = [];
      
      // Volume signals (Priority 1-2)
      if (volumeRatio > 2.0) {
        signals.push("Smart Money"); // Priority 1 - institutions moving
      }
      if (volumeRatio > 1.5 && marginPercent > 0 && (item.trend === "stable" || item.trend === "down")) {
        signals.push("Accumulation"); // Priority 2 - quiet buying
      }
      if (volumeRatio > 1.5 && marginPercent < 0) {
        signals.push("Distribution"); // Priority 3 - selling pressure
      }
      
      // Momentum signals (Priority 2)
      // "Oversold"/"Overbought" used to come from the synthesised RSI, so they fired on
      // volume alone and meant nothing. Real overbought/oversold is in the detail drawer.
      // These gate on the SIZE of the 24h move, not just its direction — "trend is down and
      // the spread is over 2%" was true of nearly every falling item once spreads were real.
      const move = Math.abs(item.changePct24h ?? 0);
      if (item.trend === "down" && move > SIGNAL_MIN_MOVE_PCT) {
        signals.push("Pullback"); // Priority 2 - meaningful drop, not noise
      }
      if (item.trend === "up" && move > SIGNAL_MIN_MOVE_PCT) {
        signals.push("Strong Trend"); // Priority 2
      }

      // Value signals (Priority 1, 3)
      // Post-tax ROI only. The old margin-percent arm double-counted the same quantity and
      // was set for a 1% world, so it fired on ~60% of items.
      if (item.roi > SIGNAL_DEEP_VALUE_ROI) {
        signals.push("Deep Value"); // Priority 1 - exceptional
      } else if (item.roi > SIGNAL_GOOD_VALUE_ROI) {
        signals.push("Good Value"); // Priority 3
      }

      // ponytail: "Favorable R/R" and "High Reward" deleted. Once the unit bug above is
      // fixed the ratio is just margin% / 2, so both restated the value signals and fired
      // on every item that already had one — measured: identical item set with and without
      // them, they only crowded the top-3 display.

      // Sort signals by priority and take top 3
      const sortedSignals = signals
        .sort((a, b) => (SIGNAL_PRIORITY[a] || 99) - (SIGNAL_PRIORITY[b] || 99))
        .slice(0, 3);
      
      return {
        ...item,
        volumeRatio,
        volumeScore,
        momentumScore,
        valueScore,
        riskScore,
        riskRewardRatio,
        tradeScore,
        signals: sortedSignals,
      };
    });
  }, [items]);

  const signalsCount = useMemo(() => 
    processedItems.filter(i => i.signals.length > 0).length,
    [processedItems]
  );

  const getFavoriteId = (itemId: number) => 
    favorites.find(f => f.itemId === itemId)?.id;

  const toggleFavorite = (item: ScannerItem) => {
    const existingFavoriteId = getFavoriteId(item.id);
    if (existingFavoriteId) {
      removeFavoriteMutation.mutate(existingFavoriteId);
    } else {
      addFavoriteMutation.mutate(item);
    }
  };

  const handleRowClick = (item: ScannerItem, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]')) {
      return;
    }
    setExpandedItemId(prev => prev === item.id ? null : item.id);
  };

  const openPortfolioDialog = (item: ScannerItem) => {
    setSelectedItem(item);
    setPortfolioForm({
      quantity: 1,
      buyPrice: item.buyPrice,
      categoryId: "",
      notes: "",
    });
    setPortfolioDialogOpen(true);
  };

  const openAlertDialog = (item: ScannerItem) => {
    setSelectedItem(item);
    setAlertForm({
      alertType: "price_above",
      threshold: item.sellPrice,
    });
    setAlertDialogOpen(true);
  };

  const handleAddToPortfolio = () => {
    if (!selectedItem) return;
    addPortfolioMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemIcon: selectedItem.icon,
      quantity: portfolioForm.quantity,
      avgBuyPrice: portfolioForm.buyPrice,
      totalCost: portfolioForm.quantity * portfolioForm.buyPrice,
      categoryId: portfolioForm.categoryId || undefined,
      notes: portfolioForm.notes || undefined,
    });
  };

  const handleCreateAlert = () => {
    if (!selectedItem) return;
    createAlertMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemIcon: selectedItem.icon,
      alertType: alertForm.alertType,
      threshold: alertForm.threshold,
    });
  };

  const getRelatedItems = (item: ScannerItem): ScannerItem[] => {
    return items
      .filter(i => 
        i.id !== item.id &&
        i.geLimit === item.geLimit &&
        i.isMembers === item.isMembers &&
        i.buyPrice >= item.buyPrice * 0.5 &&
        i.buyPrice <= item.buyPrice * 1.5
      )
      .slice(0, 5);
  };

  const filteredAndSortedItems = useMemo((): ProcessedScannerItem[] => {
    let result = [...processedItems];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }

    if (f2pOnly) {
      result = result.filter(item => !item.isMembers);
    }

    if (watchlistOnly) {
      result = result.filter(item => favoriteItemIds.has(item.id));
    }

    if (signalsOnly) {
      result = result.filter(item => item.signals.length > 0);
    }

    if (highScoreOnly) {
      result = result.filter(item => item.tradeScore >= 60);
    }

    if (selectedBuyLimit !== null) {
      result = result.filter(item => item.geLimit === selectedBuyLimit);
    }

    if (selectedPriceRange !== null) {
      const range = PRICE_RANGE_OPTIONS[selectedPriceRange];
      if (range) {
        result = result.filter(item => item.buyPrice >= range.min && item.buyPrice <= range.max);
      }
    }

    const parseNum = (val: string) => val ? parseFloat(val) : null;
    const minMargin = parseNum(filters.minMargin);
    const maxMargin = parseNum(filters.maxMargin);
    const minVolume = parseNum(filters.minVolume);
    const maxVolume = parseNum(filters.maxVolume);
    const minPotentialProfit = parseNum(filters.minPotentialProfit);
    const maxPotentialProfit = parseNum(filters.maxPotentialProfit);
    const minRoi = parseNum(filters.minRoi);
    const maxRoi = parseNum(filters.maxRoi);

    result = result.filter(item => {
      if (minMargin !== null && item.margin < minMargin) return false;
      if (maxMargin !== null && item.margin > maxMargin) return false;
      if (minVolume !== null && item.volume < minVolume) return false;
      if (maxVolume !== null && item.volume > maxVolume) return false;
      if (minPotentialProfit !== null && item.potentialProfit < minPotentialProfit) return false;
      if (maxPotentialProfit !== null && item.potentialProfit > maxPotentialProfit) return false;
      if (minRoi !== null && item.roi < minRoi) return false;
      if (maxRoi !== null && item.roi > maxRoi) return false;
      return true;
    });

    // ponytail: several sortable columns are buckets, not continuous values — trend and
    // volatility have 3 each, priceTier and confidence 4, and suggestedMarginPct resolves to
    // one constant per price tier while calculateSmartPricing gets no real indicators. Ties
    // kept whatever order they already had, so clicking those headers looked like it did
    // nothing. Falling back to netProfit gives every tie a meaningful, stable order.
    const compare = (a: ProcessedScannerItem, b: ProcessedScannerItem, key: SortKey) => {
      const aVal = a[key];
      const bVal = b[key];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal);
      }
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return (aVal ? 1 : 0) - (bVal ? 1 : 0);
      }
      // null sorts as absent, not as zero — a missing 24h change is not "no change".
      const numA = aVal == null ? Number.NEGATIVE_INFINITY : Number(aVal) || 0;
      const numB = bVal == null ? Number.NEGATIVE_INFINITY : Number(bVal) || 0;
      return numA - numB;
    };

    result.sort((a, b) => {
      const primary = compare(a, b, sortKey);
      if (primary !== 0) return sortDirection === "asc" ? primary : -primary;
      return sortKey === "netProfit" ? 0 : b.netProfit - a.netProfit;
    });

    return result;
  }, [processedItems, searchQuery, sortKey, sortDirection, f2pOnly, watchlistOnly, signalsOnly, highScoreOnly, favoriteItemIds, selectedBuyLimit, selectedPriceRange, filters]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const stats = useMemo(() => {
    const highScoreItems = processedItems.filter(i => i.tradeScore > 70).length;
    const opportunities = processedItems.filter(i => i.roi > 5 && i.netProfit > 0).length;
    const avgTradeScore = processedItems.length > 0 
      ? processedItems.reduce((sum, i) => sum + i.tradeScore, 0) / processedItems.length 
      : 0;
    const avgRoi = processedItems.length > 0 
      ? processedItems.reduce((sum, i) => sum + i.roi, 0) / processedItems.length 
      : 0;
    const lastUpdated = dataUpdatedAt ? Math.round((Date.now() - dataUpdatedAt) / 60000) : 0;
    
    return { highScoreItems, opportunities, avgTradeScore, avgRoi, lastUpdated };
  }, [processedItems, dataUpdatedAt]);

  const highScoreCount = useMemo(() => 
    processedItems.filter(i => i.tradeScore >= 60).length,
    [processedItems]
  );

  const expandedItem = expandedItemId ? items.find(i => i.id === expandedItemId) : null;
  const relatedItems = expandedItem ? getRelatedItems(expandedItem) : [];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const exportData = () => {
    const csv = [
      ["Item", "Buy", "Sell", "Margin", "ROI%", "Net Profit", "Volume", "Cap Eff", "Trend", "24h Change%", "Volatility", "AI Est.%", "Price Tier", "Confidence"].join(","),
      ...filteredAndSortedItems.map(item => [
        `"${item.name}"`,
        item.buyPrice,
        item.sellPrice,
        item.margin,
        item.roi,
        item.netProfit,
        item.volume,
        item.capitalEfficiency,
        item.trend,
        item.changePct24h ?? "",
        item.volatility,
        item.suggestedMarginPct,
        item.priceTier,
        item.confidence,
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanner-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              RS3 Trading Terminal
            </h1>
            <p className="text-sm text-muted-foreground">Advanced Market Intelligence Platform</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-700 hover:border-cyan-500/50" data-testid="button-alerts">
              <Bell className="h-4 w-4 mr-2" />
              Alerts
            </Button>
            <Button variant="outline" size="sm" onClick={exportData} className="border-slate-700 hover:border-cyan-500/50" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="icon" className="border-slate-700 hover:border-cyan-500/50" data-testid="button-settings">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" data-testid="stats-dashboard">
        <StatCard label="Total Items" value={items.length.toLocaleString()} icon={BarChart3} accent="cyan" />
        <StatCard label="Trade Signals" value={stats.highScoreItems} icon={TrendingUp} accent="purple" />
        <StatCard label="Opportunities" value={stats.opportunities} icon={Target} accent="green" />
        <StatCard label="Avg Score" value={Math.round(stats.avgTradeScore)} icon={Zap} accent="yellow" />
        <StatCard label="Last Updated" value={`${stats.lastUpdated}m ago`} icon={Clock} accent="cyan" />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-4 rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder={`Search items... (${items.length} available)`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-800/50 border-slate-700 focus:border-cyan-500/50"
            data-testid="input-search-items"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox
            id="f2p-only"
            checked={f2pOnly}
            onCheckedChange={(checked) => {
              setF2pOnly(checked === true);
              setCurrentPage(1);
            }}
            className="border-slate-600"
            data-testid="checkbox-f2p-only"
          />
          <Label htmlFor="f2p-only" className="text-sm cursor-pointer text-muted-foreground">
            F2P Only
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="watchlist-only"
            checked={watchlistOnly}
            onCheckedChange={(checked) => {
              setWatchlistOnly(checked === true);
              setCurrentPage(1);
            }}
            className="border-slate-600"
            data-testid="checkbox-watchlist-only"
          />
          <Label htmlFor="watchlist-only" className="text-sm cursor-pointer text-muted-foreground flex items-center gap-1">
            <ListFilter className="h-3 w-3" />
            Watchlist Only
            <Badge variant="outline" className="ml-1 text-xs border-yellow-500/50 text-yellow-400">
              {favorites.length}
            </Badge>
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="signals-only"
            checked={signalsOnly}
            onCheckedChange={(checked) => {
              setSignalsOnly(checked === true);
              setCurrentPage(1);
            }}
            className="border-slate-600"
            data-testid="checkbox-signals-only"
          />
          <Label htmlFor="signals-only" className="text-sm cursor-pointer text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Show Signals Only
            <Badge variant="outline" className="ml-1 text-xs border-emerald-500/50 text-emerald-400" data-testid="badge-signals-count">
              {signalsCount}
            </Badge>
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="high-score-only"
            checked={highScoreOnly}
            onCheckedChange={(checked) => {
              setHighScoreOnly(checked === true);
              setCurrentPage(1);
            }}
            className="border-slate-600"
            data-testid="checkbox-high-score-only"
          />
          <Label htmlFor="high-score-only" className="text-sm cursor-pointer text-muted-foreground flex items-center gap-1">
            <Target className="h-3 w-3" />
            High Score Only
            <Badge variant="outline" className="ml-1 text-xs border-cyan-500/50 text-cyan-400" data-testid="badge-high-score-count">
              {highScoreCount}
            </Badge>
          </Label>
        </div>

        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="border-slate-700" data-testid="button-toggle-filters">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
              <ChevronRight className={`h-4 w-4 ml-2 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <SelectTrigger className="w-32 border-slate-700 bg-slate-800/50" data-testid="select-view-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="detailed">Detailed</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <PulsingDot active />
          {filteredAndSortedItems.length.toLocaleString()} items
        </div>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent className="mb-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Buy Limit</Label>
              <div className="flex flex-wrap gap-2">
                {BUY_LIMIT_OPTIONS.map((limit) => (
                  <Button
                    key={limit}
                    variant={selectedBuyLimit === limit ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedBuyLimit(prev => prev === limit ? null : limit);
                      setCurrentPage(1);
                    }}
                    className={selectedBuyLimit === limit ? "bg-cyan-600 hover:bg-cyan-700" : "border-slate-700"}
                    data-testid={`button-buy-limit-${limit}`}
                  >
                    {limit >= 1000 ? `${limit / 1000}K` : limit}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Buy Price</Label>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGE_OPTIONS.map((range, index) => (
                  <Button
                    key={range.label}
                    variant={selectedPriceRange === index ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedPriceRange(prev => prev === index ? null : index);
                      setCurrentPage(1);
                    }}
                    className={selectedPriceRange === index ? "bg-cyan-600 hover:bg-cyan-700" : "border-slate-700"}
                    data-testid={`button-price-range-${index}`}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Min ROI %</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minRoi}
                  onChange={(e) => setFilters(prev => ({ ...prev, minRoi: e.target.value }))}
                  className="h-8 bg-slate-800/50 border-slate-700"
                  data-testid="input-min-roi"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max ROI %</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={filters.maxRoi}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxRoi: e.target.value }))}
                  className="h-8 bg-slate-800/50 border-slate-700"
                  data-testid="input-max-roi"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Min Volume</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minVolume}
                  onChange={(e) => setFilters(prev => ({ ...prev, minVolume: e.target.value }))}
                  className="h-8 bg-slate-800/50 border-slate-700"
                  data-testid="input-min-volume"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max Volume</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={filters.maxVolume}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxVolume: e.target.value }))}
                  className="h-8 bg-slate-800/50 border-slate-700"
                  data-testid="input-max-volume"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Data Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort("name")}
                  data-testid="header-name"
                >
                  ITEM <SortIcon columnKey="name" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-center"
                  onClick={() => handleSort("tradeScore" as SortKey)}
                  data-testid="header-score"
                >
                  SCORE <SortIcon columnKey={"tradeScore" as SortKey} />
                </TableHead>
                <TableHead className="text-center text-muted-foreground w-12">TREND</TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("geLimit")}
                  data-testid="header-limit"
                >
                  LIMIT <SortIcon columnKey="geLimit" />
                </TableHead>
                <TableHead className="text-center text-muted-foreground">TYPE</TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("buyPrice")}
                  data-testid="header-buy"
                >
                  BUY <SortIcon columnKey="buyPrice" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("sellPrice")}
                  data-testid="header-sell"
                >
                  SELL <SortIcon columnKey="sellPrice" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("margin")}
                  data-testid="header-margin"
                >
                  MARGIN <SortIcon columnKey="margin" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("roi")}
                  data-testid="header-roi"
                >
                  ROI % <SortIcon columnKey="roi" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("volume")}
                  data-testid="header-volume"
                >
                  VOLUME <SortIcon columnKey="volume" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("netProfit")}
                  data-testid="header-net-profit"
                >
                  NET PROFIT <SortIcon columnKey="netProfit" />
                </TableHead>
                {viewMode !== "compact" && (
                  <TableHead 
                    className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                    onClick={() => handleSort("capitalEfficiency")}
                    data-testid="header-cap-eff"
                  >
                    CAP EFF <SortIcon columnKey="capitalEfficiency" />
                  </TableHead>
                )}
                {viewMode === "detailed" && (
                  <TableHead className="text-center text-muted-foreground">STATUS</TableHead>
                )}
                <TableHead
                  className="cursor-pointer select-none text-muted-foreground hover:text-foreground text-right"
                  onClick={() => handleSort("suggestedMarginPct" as SortKey)}
                  data-testid="header-suggested"
                >
                  AI EST. % <SortIcon columnKey={"suggestedMarginPct" as SortKey} />
                </TableHead>
                <TableHead className="text-center text-muted-foreground" data-testid="header-signals">SIGNALS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const isFavorite = favoriteItemIds.has(item.id);
                const isProfitable = item.netProfit > 0;
                const isExpanded = expandedItemId === item.id;
                
                return (
                  <Fragment key={item.id}>
                    <TableRow 
                      className={`border-slate-800 transition-all duration-200 cursor-pointer ${
                        isProfitable 
                          ? "hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                          : "hover:bg-slate-800/50"
                      } ${isExpanded ? "bg-slate-800/30" : ""}`}
                      onClick={(e) => handleRowClick(item, e)}
                      data-testid={`row-item-${item.id}`}
                    >
                      <TableCell className="py-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-cyan-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFavorite(item)}
                          disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                          className="h-8 w-8"
                          data-testid={`button-favorite-${item.id}`}
                        >
                          <Star 
                            className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-slate-500 hover:text-yellow-500'}`} 
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="py-2">
                        <img 
                          src={item.icon} 
                          alt={item.name} 
                          className="w-8 h-8 object-contain"
                          loading="lazy"
                        />
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        <div className="flex items-center gap-2">
                          <TrendArrow trend={item.trend} />
                          <span className="truncate max-w-[200px]">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2" data-testid={`cell-score-${item.id}`}>
                        <div 
                          className="relative group inline-block"
                          title={`Vol: ${item.volumeScore} | Mom: ${item.momentumScore} | Val: ${item.valueScore} | Risk: ${item.riskScore}`}
                        >
                          <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                              item.tradeScore >= 80 
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                                : item.tradeScore >= 60 
                                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                                  : item.tradeScore >= 40
                                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                                    : "bg-red-500/20 border-red-500/50 text-red-400"
                            }`}
                            data-testid={`badge-score-${item.id}`}
                          >
                            {item.tradeScore}
                          </div>
                          <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg shadow-xl whitespace-nowrap">
                            <div className="text-muted-foreground mb-1">Score Breakdown:</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                              <span>Volume:</span><span className="text-cyan-400">{item.volumeScore}</span>
                              <span>Momentum:</span><span className="text-purple-400">{item.momentumScore}</span>
                              <span>Value:</span><span className="text-emerald-400">{item.valueScore}</span>
                              <span>Risk/Reward:</span><span className="text-yellow-400">{item.riskScore}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Sparkline trend={item.trend} price={item.buyPrice} />
                      </TableCell>
                      <TableCell className="text-right py-2 text-muted-foreground">
                        {item.geLimit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            item.isMembers 
                              ? "border-purple-500/50 text-purple-400" 
                              : "border-cyan-500/50 text-cyan-400"
                          }`}
                        >
                          {item.isMembers ? "P2P" : "F2P"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2 font-mono text-sm">
                        {formatGP(item.buyPrice)}
                      </TableCell>
                      <TableCell className="text-right py-2 font-mono text-sm">
                        {formatGP(item.sellPrice)}
                      </TableCell>
                      <TableCell className={`text-right py-2 font-mono text-sm font-medium ${
                        item.margin > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {formatGP(item.margin)}
                      </TableCell>
                      <TableCell className={`text-right py-2 font-medium ${
                        item.roi > 5 ? "text-emerald-400" : item.roi > 0 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {item.roi.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right py-2 text-muted-foreground">
                        <span className="flex items-center justify-end gap-1">
                          {item.volumeRatio > 2.0 && (
                            <Flame className="h-4 w-4 text-orange-400" data-testid={`icon-unusual-volume-${item.id}`} />
                          )}
                          {item.volume.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right py-2 font-mono font-bold ${
                        item.netProfit > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {formatGP(item.netProfit)}
                      </TableCell>
                      {viewMode !== "compact" && (
                        <TableCell className="text-right py-2 text-muted-foreground">
                          {(item.capitalEfficiency / 100).toFixed(2)}
                        </TableCell>
                      )}
                      {viewMode === "detailed" && (
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2 justify-center">
                            <TrendArrow trend={item.trend} />
                            <VolatilityBadge level={item.volatility} />
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right py-2" data-testid={`cell-suggested-${item.id}`}>
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-sm text-muted-foreground">{item.suggestedMarginPct.toFixed(1)}%</span>
                          <ConfidenceBadge level={item.confidence} />
                        </div>
                      </TableCell>
                      <TableCell className="py-2" data-testid={`cell-signals-${item.id}`}>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {item.signals.map((signal) => (
                            <Badge 
                              key={signal} 
                              variant="outline" 
                              className={`text-xs ${SIGNAL_STYLES[signal] || "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}
                              data-testid={`badge-signal-${signal.toLowerCase().replace(/\s/g, '-')}-${item.id}`}
                            >
                              {signal}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {isExpanded && (
                      <TableRow className="border-slate-800 bg-slate-900/80" data-testid={`row-expanded-${item.id}`}>
                        <TableCell colSpan={viewMode === "detailed" ? 20 : viewMode === "compact" ? 17 : 18} className="p-0">
                          <div className="p-4 space-y-4 border-l-2 border-cyan-500/50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div>
                                <PriceHistoryChart itemId={item.id} itemName={item.name} />
                              </div>
                              <div className="space-y-4">
                                <ItemDetailPanel 
                                  item={item} 
                                  detail={expandedItemId === item.id ? itemDetail : undefined} 
                                  isLoading={expandedItemId === item.id && isDetailLoading} 
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button 
                                    onClick={(e) => { e.stopPropagation(); openPortfolioDialog(item); }}
                                    className="bg-cyan-600 hover:bg-cyan-700"
                                    data-testid={`button-add-portfolio-${item.id}`}
                                  >
                                    <Briefcase className="h-4 w-4 mr-2" />
                                    Add to Portfolio
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); openAlertDialog(item); }}
                                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                                    data-testid={`button-set-alert-${item.id}`}
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Set Alert
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="border-slate-700"
              data-testid="button-first-page"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-slate-700"
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-slate-700"
              data-testid="button-next-page"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="border-slate-700"
              data-testid="button-last-page"
            >
              Last
            </Button>
          </div>
        </div>
      </div>

      {/* Related Items Section */}
      {expandedItem && relatedItems.length > 0 && (
        <Collapsible defaultOpen className="mt-6">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between border-slate-700 mb-2" data-testid="button-toggle-related">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Related Items - Similar to {expandedItem.name}
              </span>
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">{relatedItems.length}</Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {relatedItems.map(related => (
                  <RelatedItemCard key={related.id} item={related} />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Add to Portfolio Dialog */}
      <Dialog open={portfolioDialogOpen} onOpenChange={setPortfolioDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-cyan-400" />
              Add to Portfolio
            </DialogTitle>
            <DialogDescription>
              Add {selectedItem?.name} to your portfolio holdings.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                <img src={selectedItem.icon} alt={selectedItem.name} className="w-10 h-10 object-contain" />
                <div>
                  <p className="font-medium">{selectedItem.name}</p>
                  <p className="text-sm text-muted-foreground">Current: {formatGP(selectedItem.buyPrice)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={portfolioForm.quantity}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-portfolio-quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buy Price</Label>
                  <Input
                    type="number"
                    min={1}
                    value={portfolioForm.buyPrice}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, buyPrice: parseInt(e.target.value) || 0 }))}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-portfolio-price"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select 
                  value={portfolioForm.categoryId} 
                  onValueChange={(v) => setPortfolioForm(prev => ({ ...prev, categoryId: v }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-portfolio-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes..."
                  value={portfolioForm.notes}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-slate-800 border-slate-700 resize-none"
                  rows={2}
                  data-testid="input-portfolio-notes"
                />
              </div>
              
              <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold text-cyan-400">{formatGP(portfolioForm.quantity * portfolioForm.buyPrice)}</p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPortfolioDialogOpen(false)} className="border-slate-700">
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddToPortfolio}
                  disabled={addPortfolioMutation.isPending}
                  className="bg-cyan-600 hover:bg-cyan-700"
                  data-testid="button-confirm-add-portfolio"
                >
                  {addPortfolioMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Portfolio
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Builder Dialog */}
      <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Set Price Alert
            </DialogTitle>
            <DialogDescription>
              Create an alert for {selectedItem?.name}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                <img src={selectedItem.icon} alt={selectedItem.name} className="w-10 h-10 object-contain" />
                <div>
                  <p className="font-medium">{selectedItem.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Buy: {formatGP(selectedItem.buyPrice)} | Sell: {formatGP(selectedItem.sellPrice)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select 
                  value={alertForm.alertType} 
                  onValueChange={(v) => setAlertForm(prev => ({ ...prev, alertType: v }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Threshold Value</Label>
                <Input
                  type="number"
                  min={1}
                  value={alertForm.threshold}
                  onChange={(e) => setAlertForm(prev => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-alert-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  {alertForm.alertType.includes("price") ? "GP amount" : "Percentage value"}
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAlertDialogOpen(false)} className="border-slate-700">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAlert}
                  disabled={createAlertMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700"
                  data-testid="button-confirm-create-alert"
                >
                  {createAlertMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Create Alert
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
