import { useState, useMemo } from "react";
import { Search, Filter, Download, X, ChevronDown, ArrowUpDown } from "lucide-react";
import { FlipCard } from "./FlipCard";
import { EditFlipDialog } from "./EditFlipDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const CATEGORIES = ["High Value", "Consumables", "Weapons", "Armor", "Skilling", "Misc"];
const STRATEGIES = ["Fast Flip", "Slow Flip", "Bulk", "High Margin", "Speculative", "Other"];

interface Flip {
  id: string;
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
  strategyTag?: string;
  membershipStatus?: string;
  isMembers?: boolean;
  geLimit?: number;
}

type SortField = "date" | "profit" | "roi" | "item" | "investment";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "completed" | "open";

interface FlipCardGridProps {
  flips: Flip[];
  onDelete: (id: string) => void;
  onEdit: (id: string, data: Partial<{
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }>) => void;
  onQuickSell?: (id: string, itemName: string) => Promise<void>;
  onViewChart?: (itemId: number | undefined, itemName: string) => void;
}

const GE_TAX_RATE = 0.02;
const GE_TAX_CAP = 5_000_000;

function calculateGETax(sellPrice: number, quantity: number) {
  const grossRevenue = sellPrice * quantity;
  const rawTax = grossRevenue * GE_TAX_RATE;
  return Math.min(rawTax, GE_TAX_CAP);
}

function calculateProfit(flip: Flip) {
  if (!flip.sellPrice) return null;
  const grossRevenue = flip.sellPrice * flip.quantity;
  const tax = calculateGETax(flip.sellPrice, flip.quantity);
  const netRevenue = grossRevenue - tax;
  const totalCost = flip.buyPrice * flip.quantity;
  return netRevenue - totalCost;
}

function calculateROI(flip: Flip) {
  if (!flip.sellPrice) return null;
  const profit = calculateProfit(flip);
  if (profit === null) return null;
  const totalCost = flip.buyPrice * flip.quantity;
  return (profit / totalCost) * 100;
}

export function FlipCardGrid({ flips, onDelete, onEdit, onQuickSell, onViewChart }: FlipCardGridProps) {
  const [editingFlip, setEditingFlip] = useState<Flip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");

  const filteredAndSortedFlips = useMemo(() => {
    let result = [...flips];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(flip => 
        flip.itemName.toLowerCase().includes(query)
      );
    }

    if (statusFilter === "completed") {
      result = result.filter(flip => flip.sellDate !== undefined && flip.sellDate !== null);
    } else if (statusFilter === "open") {
      result = result.filter(flip => flip.sellDate === undefined || flip.sellDate === null);
    }

    if (categoryFilter !== "all") {
      result = result.filter(flip => flip.category === categoryFilter);
    }

    if (strategyFilter !== "all") {
      result = result.filter(flip => flip.strategyTag === strategyFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime();
          break;
        case "profit":
          const profitA = calculateProfit(a) ?? -Infinity;
          const profitB = calculateProfit(b) ?? -Infinity;
          comparison = profitB - profitA;
          break;
        case "roi":
          const roiA = calculateROI(a) ?? -Infinity;
          const roiB = calculateROI(b) ?? -Infinity;
          comparison = roiB - roiA;
          break;
        case "item":
          comparison = a.itemName.localeCompare(b.itemName);
          break;
        case "investment":
          comparison = (b.buyPrice * b.quantity) - (a.buyPrice * a.quantity);
          break;
      }
      return sortDirection === "desc" ? comparison : -comparison;
    });

    return result;
  }, [flips, searchQuery, statusFilter, categoryFilter, strategyFilter, sortField, sortDirection]);

  const handleEditFlip = (flip: Flip) => {
    setEditingFlip(flip);
  };

  const handleSaveEdit = (data: Partial<{
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }>) => {
    if (editingFlip) {
      onEdit(editingFlip.id, data);
      setEditingFlip(null);
    }
  };

  const exportToCSV = () => {
    const headers = ["Item", "Quantity", "Buy Price", "Sell Price", "Buy Date", "Sell Date", "Profit", "ROI %", "Category", "Strategy", "Notes"];
    const rows = filteredAndSortedFlips.map(flip => {
      const profit = calculateProfit(flip);
      const roi = calculateROI(flip);
      return [
        flip.itemName,
        flip.quantity,
        flip.buyPrice,
        flip.sellPrice || "",
        new Date(flip.buyDate).toLocaleDateString(),
        flip.sellDate ? new Date(flip.sellDate).toLocaleDateString() : "",
        profit !== null ? profit : "",
        roi !== null ? roi.toFixed(2) : "",
        flip.category || "",
        flip.strategyTag || "",
        flip.notes || "",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flips-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFiltersCount = [
    statusFilter !== "all",
    categoryFilter !== "all",
    strategyFilter !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setStrategyFilter("all");
    setSearchQuery("");
  };

  if (flips.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No flips recorded yet</p>
        <p className="text-sm mt-1">Add your first flip using the form above</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-flips"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2" data-testid="button-filter">
                <Filter className="h-4 w-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                All {statusFilter === "all" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("completed")}>
                Completed {statusFilter === "completed" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("open")}>
                Open {statusFilter === "open" && "✓"}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                All Categories {categoryFilter === "all" && "✓"}
              </DropdownMenuItem>
              {CATEGORIES.map(cat => (
                <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                  {cat} {categoryFilter === cat && "✓"}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Strategy</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setStrategyFilter("all")}>
                All Strategies {strategyFilter === "all" && "✓"}
              </DropdownMenuItem>
              {STRATEGIES.map(strat => (
                <DropdownMenuItem key={strat} onClick={() => setStrategyFilter(strat)}>
                  {strat} {strategyFilter === strat && "✓"}
                </DropdownMenuItem>
              ))}

              {activeFiltersCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                    Clear all filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="gap-2" data-testid="button-sort">
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSortField("date"); setSortDirection("desc"); }}>
                Newest First {sortField === "date" && sortDirection === "desc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField("date"); setSortDirection("asc"); }}>
                Oldest First {sortField === "date" && sortDirection === "asc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSortField("profit"); setSortDirection("desc"); }}>
                Highest Profit {sortField === "profit" && sortDirection === "desc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField("profit"); setSortDirection("asc"); }}>
                Lowest Profit {sortField === "profit" && sortDirection === "asc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSortField("roi"); setSortDirection("desc"); }}>
                Highest ROI {sortField === "roi" && sortDirection === "desc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField("investment"); setSortDirection("desc"); }}>
                Highest Investment {sortField === "investment" && sortDirection === "desc" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSortField("item"); setSortDirection("asc"); }}>
                A-Z by Item {sortField === "item" && sortDirection === "asc" && "✓"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            onClick={exportToCSV}
            title="Export to CSV"
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              Status: {statusFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setStatusFilter("all")}
              />
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              {categoryFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setCategoryFilter("all")}
              />
            </Badge>
          )}
          {strategyFilter !== "all" && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              {strategyFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setStrategyFilter("all")}
              />
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredAndSortedFlips.length} of {flips.length} flips
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredAndSortedFlips.map((flip) => (
          <FlipCard
            key={flip.id}
            flip={flip}
            onDelete={onDelete}
            onEdit={handleEditFlip}
            onQuickSell={onQuickSell}
            onViewChart={onViewChart}
          />
        ))}
      </div>

      {filteredAndSortedFlips.length === 0 && flips.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No flips match your current filters</p>
          <Button variant="ghost" onClick={clearFilters} className="mt-2">
            Clear all filters
          </Button>
        </div>
      )}

      <EditFlipDialog
        flip={editingFlip}
        open={editingFlip !== null}
        onOpenChange={(open) => !open && setEditingFlip(null)}
        onSubmit={handleSaveEdit}
      />
    </div>
  );
}
