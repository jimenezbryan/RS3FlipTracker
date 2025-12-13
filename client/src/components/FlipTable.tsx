import { useState, useMemo } from "react";
import { ArrowDownIcon, ArrowUpIcon, Trash2, Pencil, ChevronUp, ChevronDown, Search, X, Filter, MoreHorizontal } from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { EditFlipDialog } from "./EditFlipDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Flip {
  id: string;
  itemName: string;
  itemIcon?: string;
  quantity: number;
  buyPrice: number;
  sellPrice?: number;
  buyDate: Date;
  sellDate?: Date;
}

type SortField = "date" | "profit" | "roi" | "item" | "quantity";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "completed" | "open";

interface FlipTableProps {
  flips: Flip[];
  onDelete: (id: string) => void;
  onEdit: (id: string, data: Partial<{
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }>) => void;
  onBulkDelete?: (ids: string[]) => void;
}

const GE_TAX_RATE = 0.02;
const GE_TAX_CAP = 5_000_000;

export function FlipTable({ flips, onDelete, onEdit, onBulkDelete }: FlipTableProps) {
  const [editingFlip, setEditingFlip] = useState<Flip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const calculateGETax = (sellPrice: number, quantity: number) => {
    const grossRevenue = sellPrice * quantity;
    const rawTax = grossRevenue * GE_TAX_RATE;
    return Math.min(rawTax, GE_TAX_CAP);
  };

  const calculateProfit = (flip: Flip) => {
    if (!flip.sellPrice) return null;
    const grossRevenue = flip.sellPrice * flip.quantity;
    const tax = calculateGETax(flip.sellPrice, flip.quantity);
    const netRevenue = grossRevenue - tax;
    const totalCost = flip.buyPrice * flip.quantity;
    return netRevenue - totalCost;
  };

  const calculateROI = (flip: Flip) => {
    if (!flip.sellPrice) return null;
    const profit = calculateProfit(flip);
    if (profit === null) return null;
    const totalCost = flip.buyPrice * flip.quantity;
    return (profit / totalCost) * 100;
  };

  const getTaxPaid = (flip: Flip) => {
    if (!flip.sellPrice) return null;
    return calculateGETax(flip.sellPrice, flip.quantity);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString();
  };

  const filteredAndSortedFlips = useMemo(() => {
    let result = [...flips];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(flip => 
        flip.itemName.toLowerCase().includes(query)
      );
    }

    if (statusFilter === "completed") {
      result = result.filter(flip => flip.sellPrice !== undefined && flip.sellPrice !== null);
    } else if (statusFilter === "open") {
      result = result.filter(flip => flip.sellPrice === undefined || flip.sellPrice === null);
    }

    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime();
          break;
        case "profit":
          const profitA = calculateProfit(a) ?? -Infinity;
          const profitB = calculateProfit(b) ?? -Infinity;
          comparison = profitA - profitB;
          break;
        case "roi":
          const roiA = calculateROI(a) ?? -Infinity;
          const roiB = calculateROI(b) ?? -Infinity;
          comparison = roiA - roiB;
          break;
        case "item":
          comparison = a.itemName.localeCompare(b.itemName);
          break;
        case "quantity":
          comparison = a.quantity - b.quantity;
          break;
      }
      
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return result;
  }, [flips, searchQuery, sortField, sortDirection, statusFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAndSortedFlips.map(f => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedIds.size > 0) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? 
      <ChevronUp className="h-3 w-3 inline ml-1" /> : 
      <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const handleEditSubmit = (data: Partial<{
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

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortField("date");
    setSortDirection("desc");
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== "all" || sortField !== "date" || sortDirection !== "desc";

  if (flips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <ArrowUpIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">No flips yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Start tracking your Grand Exchange flips by adding your first item.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-flips"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flips</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="open">Open</SelectItem>
            </SelectContent>
          </Select>

          <Select value={`${sortField}-${sortDirection}`} onValueChange={(v) => {
            const [field, dir] = v.split("-") as [SortField, SortDirection];
            setSortField(field);
            setSortDirection(dir);
          }}>
            <SelectTrigger className="w-[160px]" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="profit-desc">Highest Profit</SelectItem>
              <SelectItem value="profit-asc">Lowest Profit</SelectItem>
              <SelectItem value="roi-desc">Highest ROI</SelectItem>
              <SelectItem value="roi-asc">Lowest ROI</SelectItem>
              <SelectItem value="item-asc">Item A-Z</SelectItem>
              <SelectItem value="item-desc">Item Z-A</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {selectedIds.size > 0 && onBulkDelete && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} data-testid="button-bulk-delete">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
              Clear Selection
            </Button>
          </div>
        )}

        {filteredAndSortedFlips.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="mb-2 text-lg font-semibold">No matching flips</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filters
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {onBulkDelete && (
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredAndSortedFlips.length && filteredAndSortedFlips.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                    )}
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover-elevate"
                      onClick={() => toggleSort("item")}
                    >
                      Item <SortIcon field="item" />
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover-elevate"
                      onClick={() => toggleSort("quantity")}
                    >
                      Qty <SortIcon field="quantity" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Buy Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sell Price
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover-elevate"
                      onClick={() => toggleSort("profit")}
                    >
                      Profit <SortIcon field="profit" />
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover-elevate"
                      onClick={() => toggleSort("roi")}
                    >
                      ROI % <SortIcon field="roi" />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer hover-elevate"
                      onClick={() => toggleSort("date")}
                    >
                      Dates <SortIcon field="date" />
                    </th>
                    <th className="w-12 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedFlips.map((flip, index) => {
                    const profit = calculateProfit(flip);
                    const roi = calculateROI(flip);
                    const isProfit = profit !== null && profit > 0;
                    const isLoss = profit !== null && profit < 0;

                    return (
                      <tr
                        key={flip.id}
                        className={`hover-elevate border-b transition-colors ${
                          index % 2 === 0 ? "bg-background" : "bg-card/50"
                        } ${selectedIds.has(flip.id) ? "bg-primary/10" : ""}`}
                        data-testid={`row-flip-${flip.id}`}
                      >
                        {onBulkDelete && (
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedIds.has(flip.id)}
                              onCheckedChange={(checked) => handleSelectOne(flip.id, !!checked)}
                              data-testid={`checkbox-flip-${flip.id}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ItemIcon itemName={flip.itemName} itemIcon={flip.itemIcon} size="sm" />
                            <span className="font-medium">{flip.itemName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-sm">
                          {flip.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatPrice(flip.buyPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {flip.sellPrice ? formatPrice(flip.sellPrice) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {profit !== null ? (
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1">
                                {isProfit && <ArrowUpIcon className="h-4 w-4 text-success" />}
                                {isLoss && <ArrowDownIcon className="h-4 w-4 text-destructive" />}
                                <span
                                  className={`font-mono text-sm font-medium ${
                                    isProfit ? "text-success" : isLoss ? "text-destructive" : ""
                                  }`}
                                >
                                  {profit > 0 ? "+" : ""}{formatPrice(Math.round(profit))}
                                </span>
                              </div>
                              {getTaxPaid(flip) !== null && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  -{formatPrice(Math.round(getTaxPaid(flip)!))} tax
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {roi !== null ? (
                            <span
                              className={`font-mono text-sm font-semibold ${
                                roi > 0 ? "text-success" : roi < 0 ? "text-destructive" : ""
                              }`}
                            >
                              {roi > 0 ? "+" : ""}{roi.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">
                            <div>Buy: {formatDistanceToNow(flip.buyDate, { addSuffix: true })}</div>
                            {flip.sellDate && (
                              <div>Sell: {formatDistanceToNow(flip.sellDate, { addSuffix: true })}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-actions-${flip.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setEditingFlip(flip)}
                                data-testid={`button-edit-${flip.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDelete(flip.id)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-${flip.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <EditFlipDialog
        flip={editingFlip}
        open={!!editingFlip}
        onOpenChange={(open) => !open && setEditingFlip(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
