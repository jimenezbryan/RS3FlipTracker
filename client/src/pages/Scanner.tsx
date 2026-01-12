import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, ChevronUp, ChevronDown, Filter, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

interface Favorite {
  id: string;
  itemId: number;
  itemName: string;
  itemIcon?: string;
}

type SortKey = keyof ScannerItem;
type SortDirection = "asc" | "desc";

const columnDefinitions = [
  { key: "name" as const, label: "Name", sortable: true, defaultVisible: true },
  { key: "geLimit" as const, label: "Buy Limit", sortable: true, defaultVisible: true },
  { key: "isMembers" as const, label: "Members", sortable: true, defaultVisible: true },
  { key: "buyPrice" as const, label: "Buy Price", sortable: true, defaultVisible: true },
  { key: "sellPrice" as const, label: "Sell Price", sortable: true, defaultVisible: true },
  { key: "margin" as const, label: "Margin", sortable: true, defaultVisible: true },
  { key: "volume" as const, label: "Volume", sortable: true, defaultVisible: true },
  { key: "potentialProfit" as const, label: "Potential Profit", sortable: true, defaultVisible: true },
  { key: "marginVolume" as const, label: "Margin×Volume", sortable: true, defaultVisible: true },
];

const ITEMS_PER_PAGE = 50;

export default function Scanner() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("potentialProfit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f2pOnly, setF2pOnly] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(columnDefinitions.map(col => [col.key, col.defaultVisible]))
  );
  
  const [filters, setFilters] = useState({
    minBuyLimit: "",
    maxBuyLimit: "",
    minBuyPrice: "",
    maxBuyPrice: "",
    minMargin: "",
    maxMargin: "",
    minVolume: "",
    maxVolume: "",
    minPotentialProfit: "",
    maxPotentialProfit: "",
  });

  const { data: items = [], isLoading } = useQuery<ScannerItem[]>({
    queryKey: ["/api/scanner/items"],
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

    const parseNum = (val: string) => val ? parseFloat(val) : null;
    const minBuyLimit = parseNum(filters.minBuyLimit);
    const maxBuyLimit = parseNum(filters.maxBuyLimit);
    const minBuyPrice = parseNum(filters.minBuyPrice);
    const maxBuyPrice = parseNum(filters.maxBuyPrice);
    const minMargin = parseNum(filters.minMargin);
    const maxMargin = parseNum(filters.maxMargin);
    const minVolume = parseNum(filters.minVolume);
    const maxVolume = parseNum(filters.maxVolume);
    const minPotentialProfit = parseNum(filters.minPotentialProfit);
    const maxPotentialProfit = parseNum(filters.maxPotentialProfit);

    result = result.filter(item => {
      if (minBuyLimit !== null && item.geLimit < minBuyLimit) return false;
      if (maxBuyLimit !== null && item.geLimit > maxBuyLimit) return false;
      if (minBuyPrice !== null && item.buyPrice < minBuyPrice) return false;
      if (maxBuyPrice !== null && item.buyPrice > maxBuyPrice) return false;
      if (minMargin !== null && item.margin < minMargin) return false;
      if (maxMargin !== null && item.margin > maxMargin) return false;
      if (minVolume !== null && item.volume < minVolume) return false;
      if (maxVolume !== null && item.volume > maxVolume) return false;
      if (minPotentialProfit !== null && item.potentialProfit < minPotentialProfit) return false;
      if (maxPotentialProfit !== null && item.potentialProfit > maxPotentialProfit) return false;
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
  }, [items, searchQuery, sortKey, sortDirection, f2pOnly, filters]);

  const totalPages = Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
      ? <ChevronUp className="h-4 w-4 inline ml-1" />
      : <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading scanner items...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Item Scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-xs"
              data-testid="input-search-items"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="f2p-only"
                checked={f2pOnly}
                onCheckedChange={(checked) => {
                  setF2pOnly(checked === true);
                  setCurrentPage(1);
                }}
                data-testid="checkbox-f2p-only"
              />
              <Label htmlFor="f2p-only" className="text-sm cursor-pointer">
                F2P Only
              </Label>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredAndSortedItems.length.toLocaleString()} items
            </div>
          </div>

          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-toggle-filters">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                <ChevronRight className={`h-4 w-4 ml-2 transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-md">
                <div className="space-y-2">
                  <Label className="text-xs">Buy Limit</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minBuyLimit}
                      onChange={(e) => setFilters(prev => ({ ...prev, minBuyLimit: e.target.value }))}
                      className="h-8"
                      data-testid="input-min-buy-limit"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxBuyLimit}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxBuyLimit: e.target.value }))}
                      className="h-8"
                      data-testid="input-max-buy-limit"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Buy Price</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minBuyPrice}
                      onChange={(e) => setFilters(prev => ({ ...prev, minBuyPrice: e.target.value }))}
                      className="h-8"
                      data-testid="input-min-buy-price"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxBuyPrice}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxBuyPrice: e.target.value }))}
                      className="h-8"
                      data-testid="input-max-buy-price"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Margin</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minMargin}
                      onChange={(e) => setFilters(prev => ({ ...prev, minMargin: e.target.value }))}
                      className="h-8"
                      data-testid="input-min-margin"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxMargin}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxMargin: e.target.value }))}
                      className="h-8"
                      data-testid="input-max-margin"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Volume</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minVolume}
                      onChange={(e) => setFilters(prev => ({ ...prev, minVolume: e.target.value }))}
                      className="h-8"
                      data-testid="input-min-volume"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxVolume}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxVolume: e.target.value }))}
                      className="h-8"
                      data-testid="input-max-volume"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Potential Profit</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minPotentialProfit}
                      onChange={(e) => setFilters(prev => ({ ...prev, minPotentialProfit: e.target.value }))}
                      className="h-8"
                      data-testid="input-min-potential-profit"
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxPotentialProfit}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxPotentialProfit: e.target.value }))}
                      className="h-8"
                      data-testid="input-max-potential-profit"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label className="text-xs mb-2 block">Column Visibility</Label>
                <div className="flex flex-wrap gap-4">
                  {columnDefinitions.map(col => (
                    <div key={col.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={visibleColumns[col.key]}
                        onCheckedChange={() => toggleColumnVisibility(col.key)}
                        data-testid={`checkbox-column-${col.key}`}
                      />
                      <Label htmlFor={`col-${col.key}`} className="text-xs cursor-pointer">
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-12"></TableHead>
                  {columnDefinitions.map(col => 
                    visibleColumns[col.key] && (
                      <TableHead 
                        key={col.key}
                        className={col.sortable ? "cursor-pointer select-none" : ""}
                        onClick={() => col.sortable && handleSort(col.key)}
                        data-testid={`header-${col.key}`}
                      >
                        {col.label}
                        {col.sortable && <SortIcon columnKey={col.key} />}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFavorite(item)}
                        disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                        data-testid={`button-favorite-${item.id}`}
                      >
                        <Star 
                          className={`h-4 w-4 ${favoriteItemIds.has(item.id) ? 'fill-yellow-500 text-yellow-500' : ''}`} 
                        />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <img 
                        src={item.icon} 
                        alt={item.name} 
                        className="w-8 h-8 object-contain"
                        loading="lazy"
                      />
                    </TableCell>
                    {visibleColumns.name && (
                      <TableCell className="font-medium">{item.name}</TableCell>
                    )}
                    {visibleColumns.geLimit && (
                      <TableCell className="text-right font-mono">
                        {item.geLimit.toLocaleString()}
                      </TableCell>
                    )}
                    {visibleColumns.isMembers && (
                      <TableCell>
                        {item.isMembers ? (
                          <Badge variant="secondary">P2P</Badge>
                        ) : (
                          <Badge variant="outline">F2P</Badge>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.buyPrice && (
                      <TableCell className="text-right font-mono">
                        {formatGP(item.buyPrice)}
                      </TableCell>
                    )}
                    {visibleColumns.sellPrice && (
                      <TableCell className="text-right font-mono">
                        {formatGP(item.sellPrice)}
                      </TableCell>
                    )}
                    {visibleColumns.margin && (
                      <TableCell className={`text-right font-mono ${item.margin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatGP(item.margin)}
                      </TableCell>
                    )}
                    {visibleColumns.volume && (
                      <TableCell className="text-right font-mono">
                        {formatGP(item.volume)}
                      </TableCell>
                    )}
                    {visibleColumns.potentialProfit && (
                      <TableCell className={`text-right font-mono ${item.potentialProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatGP(item.potentialProfit)}
                      </TableCell>
                    )}
                    {visibleColumns.marginVolume && (
                      <TableCell className={`text-right font-mono ${item.marginVolume >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatGP(item.marginVolume)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                      No items found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  data-testid="button-first-page"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  data-testid="button-last-page"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
