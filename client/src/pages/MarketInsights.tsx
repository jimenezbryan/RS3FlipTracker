import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
  Sparkles
} from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";

interface CommunityPriceData {
  itemId: number;
  itemName: string;
  itemIcon?: string;
  gePriceValue: number;
  communityBuyPrice: number;
  communitySellPrice: number;
  tradeCount: number;
  uniqueTraders: number;
  lastTradeDate: string;
  avgProfit: number;
  avgRoi: number;
  confidence: 'high' | 'medium' | 'low';
  priceAccuracy: number;
}

interface GEItem {
  id: number;
  name: string;
  price: number;
  icon?: string;
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle2, label: 'High Confidence' },
    medium: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock, label: 'Medium Confidence' },
    low: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertTriangle, label: 'Low - Verify In-Game' },
  };
  
  const { color, icon: Icon, label } = config[confidence];
  
  return (
    <Badge variant="outline" className={`${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000000000) {
    return `${(price / 1000000000).toFixed(2)}B`;
  }
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(2)}M`;
  }
  if (price >= 1000) {
    return `${(price / 1000).toFixed(1)}K`;
  }
  return price.toLocaleString();
}

function formatFullPrice(price: number): string {
  return price.toLocaleString();
}

function PriceComparisonCard({ data }: { data: CommunityPriceData }) {
  const gePrice = data.gePriceValue;
  const communityAvg = Math.round((data.communityBuyPrice + data.communitySellPrice) / 2);
  const priceDiff = gePrice - communityAvg;
  const priceDiffPercent = gePrice > 0 ? ((priceDiff / gePrice) * 100) : 0;
  const isGEHigher = priceDiff > 0;
  
  const daysSinceLastTrade = data.lastTradeDate 
    ? Math.floor((Date.now() - new Date(data.lastTradeDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className="hover-elevate transition-all" data-testid={`price-card-${data.itemId}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-4">
          <ItemIcon itemName={data.itemName} itemIcon={data.itemIcon} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{data.itemName}</h3>
            <ConfidenceBadge confidence={data.confidence} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">GE Price</div>
            <div className="font-mono font-semibold">{formatPrice(gePrice)} gp</div>
            {data.confidence === 'low' && (
              <div className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                May be inaccurate
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Community Price</div>
            <div className="font-mono font-semibold text-success">{formatPrice(communityAvg)} gp</div>
            <div className="text-xs text-muted-foreground">
              {data.tradeCount} trades by {data.uniqueTraders} traders
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Buy</div>
            <div className="font-mono text-sm">{formatPrice(data.communityBuyPrice)} gp</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Sell</div>
            <div className="font-mono text-sm">{formatPrice(data.communitySellPrice)} gp</div>
          </div>
        </div>

        {priceDiff !== 0 && (
          <div className={`rounded-md p-2 text-sm ${isGEHigher ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>
            <div className="flex items-center gap-1">
              {isGEHigher ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              GE is {isGEHigher ? 'higher' : 'lower'} by {formatPrice(Math.abs(priceDiff))} ({Math.abs(priceDiffPercent).toFixed(1)}%)
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Avg ROI: <span className={(data.avgRoi ?? 0) > 0 ? 'text-success' : 'text-destructive'}>{(data.avgRoi ?? 0).toFixed(1)}%</span>
          </div>
          {daysSinceLastTrade !== null && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysSinceLastTrade === 0 ? 'Today' : daysSinceLastTrade === 1 ? 'Yesterday' : `${daysSinceLastTrade}d ago`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLookup() {
  const [itemName, setItemName] = useState("");
  const [suggestions, setSuggestions] = useState<GEItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GEItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: lookupData, isLoading: isLookupLoading } = useQuery<CommunityPriceData | null>({
    queryKey: ["/api/community-prices/lookup", selectedItem?.id],
    enabled: !!selectedItem,
  });

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (itemName.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/ge/search?q=${encodeURIComponent(itemName)}`);
        if (response.ok) {
          const items: GEItem[] = await response.json();
          const validItems = items.filter(item => item.price && item.price > 0).slice(0, 10);
          setSuggestions(validItems);
          setShowSuggestions(validItems.length > 0);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [itemName]);

  const handleSelectItem = (item: GEItem) => {
    setItemName(item.name);
    setSelectedItem(item);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Quick Price Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={itemName}
            onChange={(e) => {
              setItemName(e.target.value);
              setSelectedItem(null);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search any item..."
            data-testid="input-quick-lookup"
            autoComplete="off"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 hover-elevate text-left"
                  onClick={() => handleSelectItem(item)}
                  data-testid={`lookup-suggestion-${item.id}`}
                >
                  {item.icon && (
                    <img src={item.icon} alt={item.name} className="h-6 w-6 object-contain" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      GE: {formatFullPrice(item.price)} gp
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="flex items-center gap-3 mb-3">
              {selectedItem.icon && (
                <img src={selectedItem.icon} alt={selectedItem.name} className="h-8 w-8" />
              )}
              <div>
                <div className="font-semibold">{selectedItem.name}</div>
                <div className="text-sm text-muted-foreground font-mono">
                  GE Price: {formatFullPrice(selectedItem.price)} gp
                </div>
              </div>
            </div>
            
            {isLookupLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking community data...
              </div>
            ) : lookupData ? (
              <div className="space-y-2">
                <ConfidenceBadge confidence={lookupData.confidence} />
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Community Avg Buy</div>
                    <div className="font-mono text-success">{formatFullPrice(lookupData.communityBuyPrice)} gp</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Community Avg Sell</div>
                    <div className="font-mono text-success">{formatFullPrice(lookupData.communitySellPrice)} gp</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Based on {lookupData.tradeCount} trades by {lookupData.uniqueTraders} traders
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                No community data yet. Be the first to log a flip!
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MarketInsights() {
  const { data: communityPrices = [], isLoading } = useQuery<CommunityPriceData[]>({
    queryKey: ["/api/community-prices"],
  });

  const { data: hotItems = [] } = useQuery<CommunityPriceData[]>({
    queryKey: ["/api/community-prices/hot"],
  });

  const [sortBy, setSortBy] = useState<'trades' | 'profit' | 'roi' | 'recent'>('trades');

  const sortedPrices = [...communityPrices].sort((a, b) => {
    switch (sortBy) {
      case 'trades': return b.tradeCount - a.tradeCount;
      case 'profit': return b.avgProfit - a.avgProfit;
      case 'roi': return b.avgRoi - a.avgRoi;
      case 'recent': return new Date(b.lastTradeDate).getTime() - new Date(a.lastTradeDate).getTime();
      default: return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading market insights...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Market Insights
          </h1>
          <p className="text-muted-foreground">
            Real prices from the community. Protect yourself from bad GE data.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-1">
            <QuickLookup />
            
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  Hot Right Now
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hotItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No trending items yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hotItems.slice(0, 5).map((item, index) => (
                      <div 
                        key={item.itemId}
                        className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                        data-testid={`hot-item-${item.itemId}`}
                      >
                        <div className="text-lg font-bold text-muted-foreground w-6">
                          {index + 1}
                        </div>
                        <ItemIcon itemName={item.itemName} itemIcon={item.itemIcon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.itemName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.tradeCount} trades today
                          </div>
                        </div>
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-success">How It Works</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      When you log flips, your actual buy/sell prices help build accurate community pricing data. 
                      The more traders contribute, the more reliable our prices become.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Community Price Data</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="trades" className="text-xs px-2">Most Traded</TabsTrigger>
                    <TabsTrigger value="profit" className="text-xs px-2">Top Profit</TabsTrigger>
                    <TabsTrigger value="roi" className="text-xs px-2">Best ROI</TabsTrigger>
                    <TabsTrigger value="recent" className="text-xs px-2">Recent</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {sortedPrices.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Community Data Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Start logging your flips to build community price data. 
                    Every trade you log helps other traders make better decisions.
                  </p>
                  <Button className="mt-4" asChild>
                    <a href="/">Log Your First Flip</a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sortedPrices.map((item) => (
                  <PriceComparisonCard key={item.itemId} data={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
