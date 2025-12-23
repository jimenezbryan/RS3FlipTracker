import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { PortfolioHolding, PortfolioCategory, PortfolioSnapshot } from "@shared/schema";
import { ItemIcon } from "@/components/ItemIcon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { 
  Briefcase, TrendingUp, Package, Coins, Plus, 
  Trash2, FolderPlus, Loader2, X, RefreshCw, ChevronDown,
  BarChart3, PieChart, TrendingDown, Edit2, Search
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PortfolioValueChart } from "@/components/PortfolioValueChart";

interface GEItem {
  id: number;
  name: string;
  price: number;
  icon?: string;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  profitPercent: number;
  holdingCount: number;
  holdings: Array<PortfolioHolding & { 
    currentPrice: number; 
    value: number; 
    profit: number; 
    profitPercent: number;
  }>;
  categories: Array<PortfolioCategory & {
    holdingCount: number;
    totalValue: number;
    totalCost: number;
    totalProfit: number;
    profitPercent: number;
  }>;
}

export default function Portfolio() {
  const { toast } = useToast();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isAddHoldingDialogOpen, setIsAddHoldingDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["all"]));
  
  const [holdingItemName, setHoldingItemName] = useState("");
  const [holdingQuantity, setHoldingQuantity] = useState("1");
  const [holdingBuyPrice, setHoldingBuyPrice] = useState("");
  const [holdingCategoryId, setHoldingCategoryId] = useState<string>("");
  const [holdingNotes, setHoldingNotes] = useState("");
  const [selectedGEItem, setSelectedGEItem] = useState<GEItem | null>(null);
  const [itemSuggestions, setItemSuggestions] = useState<GEItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: summary, isLoading: isSummaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"],
  });

  const { data: categories = [] } = useQuery<PortfolioCategory[]>({
    queryKey: ["/api/portfolio/categories"],
  });

  const { data: snapshots = [] } = useQuery<PortfolioSnapshot[]>({
    queryKey: ["/api/portfolio/snapshots"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("POST", "/api/portfolio/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setIsCategoryDialogOpen(false);
      setNewCategoryName("");
      toast({ title: "Category created", description: "New category has been added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/portfolio/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Category deleted", description: "Category has been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    },
  });

  const deleteHoldingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/portfolio/holdings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Holding removed", description: "Item removed from portfolio" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove holding", variant: "destructive" });
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portfolio/snapshots");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Snapshot created", description: "Portfolio values have been recorded" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create snapshot", variant: "destructive" });
    },
  });

  const createHoldingMutation = useMutation({
    mutationFn: async (data: { itemId: number; itemName: string; itemIcon?: string; quantity: number; avgBuyPrice: number; categoryId?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/portfolio/holdings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setIsAddHoldingDialogOpen(false);
      resetHoldingForm();
      toast({ title: "Holding added", description: "Item added to your portfolio" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add holding", variant: "destructive" });
    },
  });

  const resetHoldingForm = () => {
    setHoldingItemName("");
    setHoldingQuantity("1");
    setHoldingBuyPrice("");
    setHoldingCategoryId("");
    setHoldingNotes("");
    setSelectedGEItem(null);
    setItemSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (holdingItemName.trim().length < 2) {
      setItemSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/ge/search?q=${encodeURIComponent(holdingItemName)}`);
        if (response.ok) {
          const items: GEItem[] = await response.json();
          const validItems = items.filter(item => item.price && item.price > 0).slice(0, 10);
          setItemSuggestions(validItems);
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
  }, [holdingItemName]);

  const handleSelectItem = (item: GEItem) => {
    setHoldingItemName(item.name);
    setSelectedGEItem(item);
    setHoldingBuyPrice(item.price.toString());
    setItemSuggestions([]);
    setShowSuggestions(false);
  };

  const handleAddHolding = () => {
    if (!selectedGEItem || !holdingQuantity || !holdingBuyPrice) {
      toast({ title: "Error", description: "Please select an item and fill in all required fields", variant: "destructive" });
      return;
    }

    createHoldingMutation.mutate({
      itemId: selectedGEItem.id,
      itemName: selectedGEItem.name,
      itemIcon: selectedGEItem.icon,
      quantity: parseInt(holdingQuantity),
      avgBuyPrice: parseInt(holdingBuyPrice),
      categoryId: holdingCategoryId || undefined,
      notes: holdingNotes || undefined,
    });
  };

  const formatPrice = (price: number) => price.toLocaleString();

  const filteredHoldings = summary?.holdings.filter(h => 
    categoryFilter === "all" || 
    (categoryFilter === "uncategorized" && !h.categoryId) ||
    h.categoryId === categoryFilter
  ) || [];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (isSummaryLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading portfolio...</div>
        </main>
      </div>
    );
  }

  const holdingsByCategory = filteredHoldings.reduce((acc, holding) => {
    const catId = holding.categoryId || "uncategorized";
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(holding);
    return acc;
  }, {} as Record<string, typeof filteredHoldings>);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-portfolio-title">
              Portfolio
            </h2>
            <p className="text-muted-foreground">
              Track your investments and value over time
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-category">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Category</DialogTitle>
                  <DialogDescription>Add a new category to organize your holdings</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="category-name">Name</Label>
                    <Input
                      id="category-name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g., High Value, Consumables..."
                      data-testid="input-category-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category-color">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="category-color"
                        type="color"
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="h-10 w-20 p-1"
                        data-testid="input-category-color"
                      />
                      <Input
                        value={newCategoryColor}
                        onChange={(e) => setNewCategoryColor(e.target.value)}
                        className="flex-1 font-mono"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createCategoryMutation.mutate({ name: newCategoryName, color: newCategoryColor })}
                    disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                    data-testid="button-save-category"
                  >
                    {createCategoryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isAddHoldingDialogOpen} onOpenChange={(open) => { setIsAddHoldingDialogOpen(open); if (!open) resetHoldingForm(); }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-holding">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Holding
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Holding</DialogTitle>
                  <DialogDescription>Add an item to your portfolio</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="holding-item">Item</Label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="holding-item"
                            value={holdingItemName}
                            onChange={(e) => {
                              setHoldingItemName(e.target.value);
                              setSelectedGEItem(null);
                            }}
                            onFocus={() => {
                              if (itemSuggestions.length > 0) {
                                setShowSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            placeholder="Search for item..."
                            data-testid="input-holding-item"
                            autoComplete="off"
                          />
                          {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                      {showSuggestions && itemSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                          {itemSuggestions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="flex items-center gap-3 px-3 py-2 w-full text-left hover-elevate"
                              onClick={() => handleSelectItem(item)}
                              data-testid={`holding-suggestion-${item.id}`}
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
                                  {item.price.toLocaleString()} gp
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedGEItem && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                        {selectedGEItem.icon && (
                          <img src={selectedGEItem.icon} alt={selectedGEItem.name} className="h-5 w-5" />
                        )}
                        <span className="font-medium">{selectedGEItem.name}</span>
                        <span className="text-muted-foreground">@ {selectedGEItem.price.toLocaleString()} gp</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="holding-quantity">Quantity</Label>
                      <Input
                        id="holding-quantity"
                        type="number"
                        value={holdingQuantity}
                        onChange={(e) => setHoldingQuantity(e.target.value)}
                        placeholder="1"
                        min="1"
                        data-testid="input-holding-quantity"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holding-price">Buy Price (each)</Label>
                      <Input
                        id="holding-price"
                        type="number"
                        value={holdingBuyPrice}
                        onChange={(e) => setHoldingBuyPrice(e.target.value)}
                        placeholder="0"
                        data-testid="input-holding-price"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holding-category">Category (optional)</Label>
                    <Select value={holdingCategoryId} onValueChange={setHoldingCategoryId}>
                      <SelectTrigger id="holding-category" data-testid="select-holding-category">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddHoldingDialogOpen(false); resetHoldingForm(); }}>Cancel</Button>
                  <Button 
                    onClick={handleAddHolding}
                    disabled={!selectedGEItem || !holdingQuantity || !holdingBuyPrice || createHoldingMutation.isPending}
                    data-testid="button-save-holding"
                  >
                    {createHoldingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline" 
              onClick={() => createSnapshotMutation.mutate()}
              disabled={createSnapshotMutation.isPending || !summary?.holdingCount}
              data-testid="button-create-snapshot"
            >
              {createSnapshotMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Save Snapshot
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-bold" data-testid="text-total-value">
                {formatPrice(summary?.totalValue || 0)} gp
              </div>
              <p className="text-xs text-muted-foreground">
                Cost: {formatPrice(summary?.totalCost || 0)} gp
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
              {(summary?.totalProfit || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-2xl font-bold ${
                (summary?.totalProfit || 0) >= 0 ? "text-green-500" : "text-red-500"
              }`} data-testid="text-total-profit">
                {(summary?.totalProfit || 0) >= 0 ? "+" : ""}{formatPrice(summary?.totalProfit || 0)} gp
              </div>
              <p className={`text-xs ${
                (summary?.profitPercent || 0) >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                {(summary?.profitPercent || 0) >= 0 ? "+" : ""}{(summary?.profitPercent || 0).toFixed(1)}% ROI
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Holdings</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-holding-count">
                {summary?.holdingCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                In {categories.length} categories
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Snapshots</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-snapshot-count">
                {snapshots.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {snapshots.length > 0 ? `Last: ${formatDistanceToNow(new Date(snapshots[0].snapshotDate), { addSuffix: true })}` : "No snapshots yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Value Chart */}
        <div className="mb-8">
          <PortfolioValueChart 
            snapshots={snapshots}
            onCreateSnapshot={() => createSnapshotMutation.mutate()}
            isCreatingSnapshot={createSnapshotMutation.isPending}
          />
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("all")}
              data-testid="button-filter-all"
            >
              All
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={categoryFilter === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat.id)}
                className="gap-2"
                data-testid={`button-filter-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                {cat.name}
              </Button>
            ))}
            <Button
              variant={categoryFilter === "uncategorized" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("uncategorized")}
              data-testid="button-filter-uncategorized"
            >
              Uncategorized
            </Button>
          </div>
        )}

        {/* Holdings List */}
        {(summary?.holdingCount || 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No holdings yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Add items manually to start tracking your portfolio.
              </p>
              <Button onClick={() => setIsAddHoldingDialogOpen(true)} data-testid="button-add-first">
                <Plus className="mr-2 h-4 w-4" />
                Add Holding
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(holdingsByCategory).map(([catId, holdings]) => {
              const category = categories.find(c => c.id === catId);
              const catName = category?.name || "Uncategorized";
              const catColor = category?.color || "#6b7280";
              const catValue = holdings.reduce((sum, h) => sum + h.value, 0);
              const catProfit = holdings.reduce((sum, h) => sum + h.profit, 0);
              const isExpanded = expandedCategories.has(catId) || expandedCategories.has("all");

              return (
                <Collapsible key={catId} open={isExpanded} onOpenChange={() => toggleCategory(catId)}>
                  <Card data-testid={`card-category-${catName.toLowerCase().replace(/\s+/g, "-")}`}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover-elevate flex flex-row items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: catColor }} />
                          <CardTitle className="text-lg">{catName}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {holdings.length} item{holdings.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-mono font-semibold">{formatPrice(catValue)} gp</div>
                            <div className={`text-xs ${catProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {catProfit >= 0 ? "+" : ""}{formatPrice(catProfit)} gp
                            </div>
                          </div>
                          <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {holdings
                            .sort((a, b) => b.value - a.value)
                            .map((holding) => (
                              <div
                                key={holding.id}
                                className="group relative flex items-center gap-3 rounded-lg border bg-card/50 p-3 hover-elevate"
                                data-testid={`holding-${holding.id}`}
                              >
                                <ItemIcon
                                  itemName={holding.itemName}
                                  itemIcon={holding.itemIcon ?? undefined}
                                  size="md"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" title={holding.itemName}>
                                    {holding.itemName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {holding.quantity.toLocaleString()}x @ {formatPrice(holding.avgBuyPrice)} gp
                                  </div>
                                  <div className={`text-xs ${holding.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {holding.profit >= 0 ? "+" : ""}{formatPrice(holding.profit)} ({holding.profitPercent.toFixed(1)}%)
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-semibold">{formatPrice(holding.value)}</div>
                                  <div className="text-xs text-muted-foreground">gp</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={() => deleteHoldingMutation.mutate(holding.id)}
                                  data-testid={`button-delete-holding-${holding.id}`}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* Category Management Section */}
        {categories.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
              <CardDescription>Manage your portfolio categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <div 
                    key={cat.id}
                    className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2"
                    data-testid={`category-tag-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                    <span className="font-medium">{cat.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => deleteCategoryMutation.mutate(cat.id)}
                      data-testid={`button-delete-category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
