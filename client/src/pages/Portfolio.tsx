import { useState, useRef } from "react";
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
  Upload, Briefcase, TrendingUp, Package, Coins, Plus, Camera, 
  Trash2, FolderPlus, Loader2, Check, X, RefreshCw, ChevronDown,
  BarChart3, PieChart, TrendingDown, Edit2
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PortfolioValueChart } from "@/components/PortfolioValueChart";

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

interface ImportItem {
  original: { name: string; quantity: number; confidence: number };
  match: { id: number; name: string; price?: number; icon?: string } | null;
  matchConfidence: number;
  selected: boolean;
  avgBuyPrice: number;
  categoryId: string | null;
  notes?: string;
}

interface ImportResult {
  items: ImportItem[];
  method: "ai" | "ocr";
  overallConfidence: number;
}

export default function Portfolio() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [importMethod, setImportMethod] = useState<"ai" | "ocr" | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isAddHoldingDialogOpen, setIsAddHoldingDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3b82f6");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["all"]));

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

  const confirmImportMutation = useMutation({
    mutationFn: async (items: Array<{
      itemId: number;
      itemName: string;
      itemIcon?: string;
      quantity: number;
      avgBuyPrice: number;
      categoryId?: string;
    }>) => {
      return await apiRequest("POST", "/api/portfolio/import/confirm", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      setIsImportDialogOpen(false);
      setImportItems([]);
      toast({ title: "Import complete", description: "Items have been added to your portfolio" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to import items", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("screenshot", file);

    try {
      const response = await fetch("/api/portfolio/import/screenshot", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      
      const items: ImportItem[] = result.items.map((item: any) => ({
        ...item,
        selected: item.match !== null && (item.matchConfidence > 0.5 || item.original.confidence > 0.7),
        avgBuyPrice: item.match?.price || 0,
        categoryId: null,
        notes: item.notes,
      }));

      setImportItems(items);
      setImportMethod(result.method || "ocr");
      setIsImportDialogOpen(true);
      
      if (result.method === "ai") {
        toast({ 
          title: "AI Analysis Complete", 
          description: `Identified ${items.length} items from your screenshot` 
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to process screenshot", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleItemSelection = (index: number) => {
    setImportItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateItemPrice = (index: number, price: number) => {
    setImportItems(prev => prev.map((item, i) => 
      i === index ? { ...item, avgBuyPrice: price } : item
    ));
  };

  const updateItemCategory = (index: number, categoryId: string | null) => {
    setImportItems(prev => prev.map((item, i) => 
      i === index ? { ...item, categoryId } : item
    ));
  };

  const handleConfirmImport = () => {
    const selectedItems = importItems
      .filter(item => item.selected && item.match)
      .map(item => ({
        itemId: item.match!.id,
        itemName: item.match!.name,
        itemIcon: item.match?.icon,
        quantity: item.original.quantity,
        avgBuyPrice: item.avgBuyPrice,
        categoryId: item.categoryId || undefined,
      }));

    if (selectedItems.length === 0) {
      toast({ title: "No items selected", description: "Please select at least one item to import", variant: "destructive" });
      return;
    }

    confirmImportMutation.mutate(selectedItems);
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-screenshot-file"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              data-testid="button-import-screenshot"
            >
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Import Screenshot
            </Button>
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

        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Review Imported Items
                {importMethod === "ai" && (
                  <Badge variant="secondary" className="text-xs">
                    AI Powered
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {importMethod === "ai" 
                  ? "AI has identified these items from your screenshot. Review and adjust as needed."
                  : "Select items to add to your portfolio and set their buy prices"
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {importItems.map((item, index) => (
                <div 
                  key={index}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${
                    item.selected ? "border-primary bg-primary/5" : "border-muted opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleItemSelection(index)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        item.selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                      }`}
                      data-testid={`checkbox-import-item-${index}`}
                    >
                      {item.selected && <Check className="h-3 w-3" />}
                    </button>
                    {item.match?.icon && (
                      <img src={item.match.icon} alt="" className="h-10 w-10 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item.match?.name || item.original.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Qty: {item.original.quantity.toLocaleString()}</span>
                        {item.match && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              item.original.confidence >= 0.8 ? "border-green-500 text-green-500" :
                              item.original.confidence >= 0.6 ? "border-yellow-500 text-yellow-500" :
                              "border-orange-500 text-orange-500"
                            }`}
                          >
                            {Math.round(item.original.confidence * 100)}% confident
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.avgBuyPrice}
                        onChange={(e) => updateItemPrice(index, parseInt(e.target.value) || 0)}
                        className="w-28 font-mono text-right"
                        disabled={!item.selected}
                        data-testid={`input-import-price-${index}`}
                      />
                      <span className="text-sm text-muted-foreground">gp</span>
                    </div>
                    <Select
                      value={item.categoryId || "none"}
                      onValueChange={(v) => updateItemCategory(index, v === "none" ? null : v)}
                      disabled={!item.selected}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-import-category-${index}`}>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Category</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {item.notes && (
                    <div className="ml-8 text-xs text-muted-foreground italic">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
              {importItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No items detected in screenshot
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleConfirmImport}
                disabled={confirmImportMutation.isPending || importItems.filter(i => i.selected).length === 0}
                data-testid="button-confirm-import"
              >
                {confirmImportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {importItems.filter(i => i.selected).length} Items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                Import a screenshot of your bank or add items manually to start tracking.
              </p>
              <Button onClick={() => fileInputRef.current?.click()} data-testid="button-import-first">
                <Upload className="mr-2 h-4 w-4" />
                Import Screenshot
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
