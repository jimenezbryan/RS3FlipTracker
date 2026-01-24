import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Star, ChevronUp, ChevronDown, Filter, ChevronRight, 
  TrendingUp, TrendingDown, Minus, Bell, Download, Settings,
  BarChart3, Zap, Target, Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { formatGP } from "@/lib/formatters";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  rsi: number;
  trend: "up" | "down" | "stable";
  volatility: "low" | "medium" | "high";
}

interface Favorite {
  id: string;
  itemId: number;
  itemName: string;
  itemIcon?: string;
}

type SortKey = keyof ScannerItem;
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

function StatusBar({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.min((value / max) * 100, 100);
  const color = percent > 70 ? "bg-emerald-500" : percent > 30 ? "bg-cyan-500" : "bg-red-500";
  
  return (
    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${percent}%` }}
      />
    </div>
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

export default function Scanner() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("netProfit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f2pOnly, setF2pOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  
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

  const favoriteItemIds = useMemo(() => 
    new Set(favorites.map(f => f.itemId)),
    [favorites]
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

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }

    if (f2pOnly) {
      result = result.filter(item => !item.isMembers);
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

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDirection === "asc" 
          ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
          : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }
      
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });

    return result;
  }, [items, searchQuery, sortKey, sortDirection, f2pOnly, selectedBuyLimit, selectedPriceRange, filters]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const highVolumeItems = items.filter(i => i.volume > 1000).length;
    const opportunities = items.filter(i => i.roi > 5 && i.netProfit > 0).length;
    const avgRoi = items.length > 0 
      ? items.reduce((sum, i) => sum + i.roi, 0) / items.length 
      : 0;
    const lastUpdated = dataUpdatedAt ? Math.round((Date.now() - dataUpdatedAt) / 60000) : 0;
    
    return { highVolumeItems, opportunities, avgRoi, lastUpdated };
  }, [items, dataUpdatedAt]);

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
      ["Item", "Buy", "Sell", "Margin", "ROI%", "Net Profit", "Volume", "Cap Eff", "Trend", "Volatility"].join(","),
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
        item.volatility,
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Items" value={items.length.toLocaleString()} icon={BarChart3} accent="cyan" />
        <StatCard label="High Volume" value={stats.highVolumeItems} icon={TrendingUp} accent="purple" />
        <StatCard label="Opportunities" value={stats.opportunities} icon={Target} accent="green" />
        <StatCard label="Avg ROI" value={`${stats.avgRoi.toFixed(1)}%`} icon={Zap} accent="yellow" />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const isFavorite = favoriteItemIds.has(item.id);
                const isProfitable = item.netProfit > 0;
                
                return (
                  <TableRow 
                    key={item.id} 
                    className={`border-slate-800 transition-all duration-200 ${
                      isProfitable 
                        ? "hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                        : "hover:bg-slate-800/50"
                    }`}
                    data-testid={`row-item-${item.id}`}
                  >
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
                      {item.volume.toLocaleString()}
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
                          <StatusBar value={item.rsi} />
                          <VolatilityBadge level={item.volatility} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
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
    </div>
  );
}
