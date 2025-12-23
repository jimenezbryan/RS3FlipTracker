import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Search, Loader2, TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown, Clock, AlertTriangle, Star, X, Sparkles, ChevronDown, ChevronUp, LineChart } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Favorite, RsAccount } from "@shared/schema";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { calculateFlipTax, formatGp } from "@shared/taxCalculator";

interface GEItem {
  id: number;
  name: string;
  price: number;
  volume?: number;
  icon?: string;
  isMembers?: boolean;
  geLimit?: number;
  examine?: string;
}

interface PriceTrend {
  direction: "rising" | "falling" | "stable";
  changePercent: number;
  changeAmount: number;
  trendDays: number;
  avgPrice7d: number;
  avgPrice30d: number;
  lowPrice30d: number;
  highPrice30d: number;
  recommendation: "buy" | "sell" | "hold";
  recommendationReason: string;
}

interface PriceSuggestion {
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  potentialProfit: number;
  potentialROI: number;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  buyReason: string;
  sellReason: string;
  currentPrice: number;
  avgPrice7d: number;
  avgPrice30d: number;
  lowPrice30d: number;
  highPrice30d: number;
  volatility: number;
  trend: "rising" | "falling" | "stable";
}

interface OpenPosition {
  id: string;
  itemName: string;
  quantity: number;
  buyPrice: number;
  buyDate: Date;
}

interface FlipFormProps {
  onSubmit: (flip: {
    itemName: string;
    itemIcon?: string;
    itemId?: number;
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
    notes?: string;
    category?: string;
    strategyTag: "Fast Flip" | "Slow Flip" | "Bulk" | "High Margin" | "Speculative" | "Other";
    membershipStatus: "F2P" | "Members" | "Unknown";
    rsAccountId?: string;
    isMembers?: boolean;
    geLimit?: number;
  }) => void;
  openPositions?: OpenPosition[];
}

const CATEGORIES = ["High Value", "Consumables", "Weapons", "Armor", "Skilling", "Misc"];

const STRATEGIES = ["Fast Flip", "Slow Flip", "Bulk", "High Margin", "Speculative", "Other"];

const MEMBERSHIP_STATUSES = ["F2P", "Members", "Unknown"] as const;

export function FlipForm({ onSubmit, openPositions = [] }: FlipFormProps) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyDate, setBuyDate] = useState<Date>(new Date());
  const [sellDate, setSellDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("none");
  const [strategyTag, setStrategyTag] = useState<"Fast Flip" | "Slow Flip" | "Bulk" | "High Margin" | "Speculative" | "Other">("Other");
  const [membershipStatus, setMembershipStatus] = useState<"F2P" | "Members" | "Unknown">("Unknown");
  const [selectedRsAccountId, setSelectedRsAccountId] = useState<string>("");
  const [buyDateOpen, setBuyDateOpen] = useState(false);
  const [sellDateOpen, setSellDateOpen] = useState(false);
  
  const [gePrice, setGePrice] = useState<GEItem | null>(null);
  
  const { data: rsAccounts = [] } = useQuery<RsAccount[]>({
    queryKey: ["/api/rs-accounts"],
  });
  
  const taxCalc = useMemo(() => {
    const buy = parseInt(buyPrice) || 0;
    const sell = parseInt(sellPrice) || 0;
    const qty = parseInt(quantity) || 1;
    if (sell > 0 && buy > 0) {
      return calculateFlipTax(sell, buy, qty, gePrice?.id, itemName);
    }
    return null;
  }, [buyPrice, sellPrice, quantity, gePrice?.id, itemName]);
  const [priceTrend, setPriceTrend] = useState<PriceTrend | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<PriceSuggestion | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [suggestions, setSuggestions] = useState<GEItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: favorites = [] } = useQuery<Favorite[]>({
    queryKey: ["/api/favorites"],
  });

  const addFavoriteMutation = useMutation({
    mutationFn: async (item: { itemId: number; itemName: string; itemIcon?: string }) => {
      return await apiRequest("POST", "/api/favorites", item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/favorites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const isFavorited = (itemId: number) => {
    return favorites.some(f => f.itemId === itemId);
  };

  const getFavoriteId = (itemId: number) => {
    const fav = favorites.find(f => f.itemId === itemId);
    return fav?.id;
  };

  const toggleFavorite = (item: GEItem) => {
    if (isFavorited(item.id)) {
      const favId = getFavoriteId(item.id);
      if (favId) {
        removeFavoriteMutation.mutate(favId);
      }
    } else {
      addFavoriteMutation.mutate({
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon,
      });
    }
  };

  const selectFavoriteItem = async (favorite: Favorite) => {
    setItemName(favorite.itemName);
    const item: GEItem = {
      id: favorite.itemId,
      name: favorite.itemName,
      price: 0,
      icon: favorite.itemIcon ?? undefined,
    };
    
    try {
      const response = await fetch(`/api/ge/price?name=${encodeURIComponent(favorite.itemName)}`);
      if (response.ok) {
        const data: GEItem = await response.json();
        item.price = data.price;
        setGePrice(data);
        if (data.id) {
          fetchTrend(data.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch price for favorite:", error);
    }
  };

  const duplicatePosition = useMemo(() => {
    if (!itemName.trim()) return null;
    return openPositions.find(
      pos => pos.itemName.toLowerCase() === itemName.toLowerCase()
    );
  }, [itemName, openPositions]);

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
    setGePrice(item);
    setSuggestions([]);
    setShowSuggestions(false);
    
    if (item.isMembers !== undefined) {
      setMembershipStatus(item.isMembers ? "Members" : "F2P");
    }
    
    if (item.examine) {
      const examineText = item.examine.toLowerCase();
      if (examineText.includes("weapon") || examineText.includes("sword") || examineText.includes("bow") || examineText.includes("staff") || examineText.includes("wand")) {
        setCategory("Weapons");
      } else if (examineText.includes("armour") || examineText.includes("armor") || examineText.includes("helm") || examineText.includes("shield") || examineText.includes("platebody") || examineText.includes("platelegs")) {
        setCategory("Armor");
      } else if (examineText.includes("potion") || examineText.includes("food") || examineText.includes("eat") || examineText.includes("drink") || examineText.includes("restores")) {
        setCategory("Consumables");
      } else if (examineText.includes("ore") || examineText.includes("log") || examineText.includes("fish") || examineText.includes("herb") || examineText.includes("seed") || examineText.includes("bar") || examineText.includes("rune")) {
        setCategory("Skilling");
      }
    }
    
    if (item.id) {
      fetchTrend(item.id);
    }
  };

  const fetchTrend = async (itemId: number) => {
    try {
      const [trendResponse, suggestionsResponse] = await Promise.all([
        fetch(`/api/ge/trend/${itemId}`),
        fetch(`/api/ge/suggestions/${itemId}`)
      ]);
      
      if (trendResponse.ok) {
        const trendData: PriceTrend = await trendResponse.json();
        setPriceTrend(trendData);
      } else {
        setPriceTrend(null);
      }
      
      if (suggestionsResponse.ok) {
        const suggestionsData: PriceSuggestion = await suggestionsResponse.json();
        setAiSuggestions(suggestionsData);
      } else {
        setAiSuggestions(null);
      }
    } catch (error) {
      console.error("Failed to fetch trend/suggestions:", error);
      setPriceTrend(null);
      setAiSuggestions(null);
    }
  };

  const handleLookup = async () => {
    if (!itemName.trim()) return;
    
    setIsLookingUp(true);
    setLookupError("");
    setGePrice(null);
    setPriceTrend(null);
    
    try {
      const response = await fetch(`/api/ge/price?name=${encodeURIComponent(itemName)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setLookupError("Item not found in Grand Exchange");
        } else {
          setLookupError("Failed to fetch price");
        }
        setIsLookingUp(false);
        return;
      }
      
      const data: GEItem = await response.json();
      setGePrice(data);
      setItemName(data.name || itemName);
      
      if (data.isMembers !== undefined) {
        setMembershipStatus(data.isMembers ? "Members" : "F2P");
      }
      
      if (data.id) {
        await fetchTrend(data.id);
      }
    } catch (error) {
      setLookupError("Failed to connect to GE API");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleUseBuyPrice = () => {
    if (gePrice) {
      setBuyPrice(gePrice.price.toString());
    }
  };

  const handleUseSellPrice = () => {
    if (gePrice) {
      setSellPrice(gePrice.price.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemName || !quantity || !buyPrice || !buyDate) return;

    onSubmit({
      itemName,
      itemIcon: gePrice?.icon,
      itemId: gePrice?.id,
      quantity: parseInt(quantity),
      buyPrice: parseInt(buyPrice),
      sellPrice: sellPrice ? parseInt(sellPrice) : undefined,
      buyDate: buyDate,
      sellDate: sellDate,
      notes: notes || undefined,
      category: category && category !== "none" ? category : undefined,
      strategyTag,
      membershipStatus,
      rsAccountId: selectedRsAccountId || undefined,
      isMembers: gePrice?.isMembers,
      geLimit: gePrice?.geLimit,
    });

    setItemName("");
    setQuantity("1");
    setBuyPrice("");
    setSellPrice("");
    setBuyDate(new Date());
    setSellDate(undefined);
    setNotes("");
    setMembershipStatus("Unknown");
    setCategory("none");
    setStrategyTag("Other");
    setGePrice(null);
    setPriceTrend(null);
    setAiSuggestions(null);
    setShowChart(false);
    setLookupError("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleUseSuggestedBuyPrice = () => {
    if (aiSuggestions) {
      setBuyPrice(aiSuggestions.suggestedBuyPrice.toString());
    }
  };

  const handleUseSuggestedSellPrice = () => {
    if (aiSuggestions) {
      setSellPrice(aiSuggestions.suggestedSellPrice.toString());
    }
  };

  const handleUseBothSuggestions = () => {
    if (aiSuggestions) {
      setBuyPrice(aiSuggestions.suggestedBuyPrice.toString());
      setSellPrice(aiSuggestions.suggestedSellPrice.toString());
    }
  };

  const getConfidenceBadge = () => {
    if (!aiSuggestions) return null;
    switch (aiSuggestions.confidence) {
      case "high":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            High Confidence
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="secondary">
            Medium Confidence
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="border-warning text-warning">
            Low Confidence
          </Badge>
        );
    }
  };

  const getTrendIcon = () => {
    if (!priceTrend) return null;
    switch (priceTrend.direction) {
      case "rising":
        return <TrendingUp className="h-4 w-4" />;
      case "falling":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!priceTrend) return "";
    switch (priceTrend.direction) {
      case "rising":
        return "text-success";
      case "falling":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getRecommendationBadge = () => {
    if (!priceTrend) return null;
    switch (priceTrend.recommendation) {
      case "buy":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <ThumbsUp className="mr-1 h-3 w-3" />
            Good to Buy
          </Badge>
        );
      case "sell":
        return (
          <Badge variant="destructive">
            <ThumbsDown className="mr-1 h-3 w-3" />
            Consider Selling
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Hold
          </Badge>
        );
    }
  };

  const setQuickDate = (type: 'buy' | 'sell', preset: 'today' | 'yesterday' | 'week') => {
    let date: Date;
    switch (preset) {
      case 'today':
        date = new Date();
        break;
      case 'yesterday':
        date = subDays(new Date(), 1);
        break;
      case 'week':
        date = subDays(new Date(), 7);
        break;
    }
    
    if (type === 'buy') {
      setBuyDate(date);
      setBuyDateOpen(false);
    } else {
      setSellDate(date);
      setSellDateOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Log Flip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {favorites.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                Quick Add from Favorites
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {favorites.map((fav) => (
                  <Badge
                    key={fav.id}
                    variant="secondary"
                    className="cursor-pointer gap-1.5 pr-1"
                    data-testid={`badge-favorite-${fav.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectFavoriteItem(fav)}
                      className="flex items-center gap-1.5"
                    >
                      {fav.itemIcon && (
                        <img 
                          src={fav.itemIcon} 
                          alt={fav.itemName}
                          className="h-4 w-4 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span className="text-xs">{fav.itemName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavoriteMutation.mutate(fav.id);
                      }}
                      className="p-0.5 rounded hover-elevate"
                      data-testid={`button-remove-favorite-${fav.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="itemName">Item Name</Label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    id="itemName"
                    value={itemName}
                    onChange={(e) => {
                      setItemName(e.target.value);
                      setGePrice(null);
                      setPriceTrend(null);
                      setAiSuggestions(null);
                      setShowChart(false);
                      setLookupError("");
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Start typing to search..."
                    data-testid="input-item-name"
                    autoComplete="off"
                    required
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={handleLookup}
                  disabled={isLookingUp || !itemName.trim()}
                  data-testid="button-lookup-price"
                >
                  {isLookingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-auto" data-testid="suggestions-dropdown">
                  {suggestions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2 hover-elevate"
                    >
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-3 text-left"
                        onClick={() => handleSelectItem(item)}
                        data-testid={`suggestion-item-${item.id}`}
                      >
                        {item.icon && (
                          <img 
                            src={item.icon} 
                            alt={item.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {item.price ? item.price.toLocaleString() : "N/A"} gp
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item);
                        }}
                        className="p-1 rounded hover-elevate"
                        data-testid={`button-favorite-${item.id}`}
                      >
                        <Star 
                          className={cn(
                            "h-4 w-4",
                            isFavorited(item.id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                          )} 
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {lookupError && (
              <p className="text-sm text-destructive">{lookupError}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategy" className="flex items-center gap-1">
                  Strategy <span className="text-destructive">*</span>
                </Label>
                <Select value={strategyTag} onValueChange={(v) => setStrategyTag(v as typeof strategyTag)}>
                  <SelectTrigger id="strategy" data-testid="select-strategy">
                    <SelectValue placeholder="Select strategy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map(strat => (
                      <SelectItem key={strat} value={strat}>{strat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="membershipStatus">Item Type</Label>
                <Select value={membershipStatus} onValueChange={(v) => setMembershipStatus(v as typeof membershipStatus)}>
                  <SelectTrigger id="membershipStatus" data-testid="select-membership">
                    <SelectValue placeholder="Select item type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {rsAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="rsAccount">RS Account</Label>
                  <Select value={selectedRsAccountId || "any"} onValueChange={(v) => setSelectedRsAccountId(v === "any" ? "" : v)}>
                    <SelectTrigger id="rsAccount" data-testid="select-rs-account">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Account</SelectItem>
                      {rsAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.displayName} ({acc.accountType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {duplicatePosition && (
              <div className="rounded-md border border-warning bg-warning/10 p-3" data-testid="warning-duplicate-position">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-warning-foreground">Open position exists</p>
                    <p className="text-muted-foreground">
                      You already have an open position for {duplicatePosition.itemName}: {duplicatePosition.quantity.toLocaleString()} units at {duplicatePosition.buyPrice.toLocaleString()} gp each
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {gePrice && (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    {gePrice.icon && (
                      <img 
                        src={gePrice.icon} 
                        alt={gePrice.name}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">GE Price</span>
                      </div>
                      <div className="font-mono text-lg font-semibold text-success">
                        {gePrice.price.toLocaleString()} gp
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {gePrice.volume && (
                          <span>Vol: {gePrice.volume.toLocaleString()}</span>
                        )}
                        {gePrice.geLimit && (
                          <span>Limit: {gePrice.geLimit.toLocaleString()}</span>
                        )}
                        {gePrice.isMembers !== undefined && (
                          <Badge variant={gePrice.isMembers ? "secondary" : "outline"} className="text-xs h-5">
                            {gePrice.isMembers ? "Members" : "F2P"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(gePrice)}
                      data-testid="button-toggle-favorite-selected"
                    >
                      <Star 
                        className={cn(
                          "h-5 w-5",
                          isFavorited(gePrice.id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                        )} 
                      />
                    </Button>
                  </div>
                </div>

                {priceTrend && (
                  <div className="rounded-md border bg-card p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 font-medium ${getTrendColor()}`}>
                          {getTrendIcon()}
                          {priceTrend.direction === "rising" ? "Rising" : 
                           priceTrend.direction === "falling" ? "Falling" : "Stable"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          for {priceTrend.trendDays} day{priceTrend.trendDays !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span className={`font-mono text-sm ${priceTrend.changePercent > 0 ? "text-success" : priceTrend.changePercent < 0 ? "text-destructive" : ""}`}>
                        {priceTrend.changePercent > 0 ? "+" : ""}{priceTrend.changePercent}% ({priceTrend.changeAmount > 0 ? "+" : ""}{priceTrend.changeAmount.toLocaleString()} gp)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">7d Avg:</span>{" "}
                        <span className="font-mono">{priceTrend.avgPrice7d.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">30d Avg:</span>{" "}
                        <span className="font-mono">{priceTrend.avgPrice30d.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">30d Low:</span>{" "}
                        <span className="font-mono text-success">{priceTrend.lowPrice30d.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">30d High:</span>{" "}
                        <span className="font-mono text-destructive">{priceTrend.highPrice30d.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-1">
                        {getRecommendationBadge()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {priceTrend.recommendationReason}
                      </p>
                    </div>
                  </div>
                )}

                {aiSuggestions && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3" data-testid="ai-suggestions-panel">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">AI Price Suggestions</span>
                      </div>
                      {getConfidenceBadge()}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Suggested Buy</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-1.5 py-0.5 text-xs"
                            onClick={handleUseSuggestedBuyPrice}
                            data-testid="button-use-suggested-buy"
                          >
                            Use
                          </Button>
                        </div>
                        <div className="font-mono text-lg font-semibold text-success">
                          {aiSuggestions.suggestedBuyPrice.toLocaleString()} gp
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {aiSuggestions.buyReason}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Suggested Sell</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto px-1.5 py-0.5 text-xs"
                            onClick={handleUseSuggestedSellPrice}
                            data-testid="button-use-suggested-sell"
                          >
                            Use
                          </Button>
                        </div>
                        <div className="font-mono text-lg font-semibold text-destructive">
                          {aiSuggestions.suggestedSellPrice.toLocaleString()} gp
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {aiSuggestions.sellReason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Potential Profit:</span>
                          <span className="font-mono font-medium text-success">
                            +{aiSuggestions.potentialProfit.toLocaleString()} gp
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            ({aiSuggestions.potentialROI.toFixed(1)}% ROI)
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          Volatility: {aiSuggestions.volatility.toFixed(1)}%
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleUseBothSuggestions}
                        data-testid="button-use-both-suggestions"
                      >
                        Use Both
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground border-t pt-2">
                      {aiSuggestions.confidenceReason}
                    </p>
                  </div>
                )}

                {gePrice?.id && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowChart(!showChart)}
                      data-testid="button-toggle-chart"
                    >
                      <LineChart className="mr-2 h-4 w-4" />
                      {showChart ? "Hide" : "Show"} Price Chart
                      {showChart ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                    </Button>
                    {showChart && (
                      <div className="rounded-md border bg-card p-2" data-testid="inline-price-chart">
                        <PriceHistoryChart itemId={gePrice.id} itemName={gePrice.name} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              min="1"
              data-testid="input-quantity"
              className="font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="buyPrice">Buy Price</Label>
                {gePrice && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="h-auto px-2 py-0.5 text-xs"
                    onClick={handleUseBuyPrice}
                    data-testid="button-use-buy-price"
                  >
                    Use GE
                  </Button>
                )}
              </div>
              <Input
                id="buyPrice"
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="0"
                data-testid="input-buy-price"
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sellPrice">Sell Price</Label>
                {gePrice && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="h-auto px-2 py-0.5 text-xs"
                    onClick={handleUseSellPrice}
                    data-testid="button-use-sell-price"
                  >
                    Use GE
                  </Button>
                )}
              </div>
              <Input
                id="sellPrice"
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="0"
                data-testid="input-sell-price"
                className="font-mono"
              />
              {taxCalc && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxCalc.isTaxExempt ? "Exempt" : "2%"}):</span>
                    <span className="font-mono text-destructive">
                      -{formatGp(taxCalc.totalTax)} gp
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Net Received:</span>
                    <span className="font-mono text-success">
                      {formatGp(taxCalc.netSellTotal)} gp
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit:</span>
                    <span className={cn(
                      "font-mono font-semibold",
                      taxCalc.profit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {taxCalc.profit >= 0 ? "+" : ""}{formatGp(taxCalc.profit)} gp
                    </span>
                  </div>
                  {taxCalc.isTaxExempt && taxCalc.exemptReason && (
                    <p className="text-muted-foreground italic">{taxCalc.exemptReason}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buy Date</Label>
              <Popover open={buyDateOpen} onOpenChange={setBuyDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !buyDate && "text-muted-foreground"
                    )}
                    data-testid="button-buy-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {buyDate ? format(buyDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('buy', 'today')}
                      data-testid="button-buy-today"
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('buy', 'yesterday')}
                      data-testid="button-buy-yesterday"
                    >
                      Yesterday
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('buy', 'week')}
                      data-testid="button-buy-week-ago"
                    >
                      Week ago
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={buyDate}
                    onSelect={(date) => {
                      if (date) {
                        setBuyDate(date);
                        setBuyDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Sell Date</Label>
              <Popover open={sellDateOpen} onOpenChange={setSellDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !sellDate && "text-muted-foreground"
                    )}
                    data-testid="button-sell-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {sellDate ? format(sellDate, "MMM d, yyyy") : "Not sold yet"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('sell', 'today')}
                      data-testid="button-sell-today"
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('sell', 'yesterday')}
                      data-testid="button-sell-yesterday"
                    >
                      Yesterday
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSellDate(undefined);
                        setSellDateOpen(false);
                      }}
                      data-testid="button-sell-clear"
                    >
                      Clear
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={sellDate}
                    onSelect={(date) => {
                      setSellDate(date);
                      setSellDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this flip (optional)..."
              className="resize-none"
              rows={2}
              data-testid="input-notes"
            />
          </div>

          <Button type="submit" className="w-full" data-testid="button-add-flip">
            Add Flip
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
