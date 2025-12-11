import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WatchlistItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2, TrendingUp, TrendingDown, Eye, Bell } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";

interface GEItem {
  id: number;
  name: string;
  price: number;
  icon?: string;
}

export default function Watchlist() {
  const { toast } = useToast();
  const [itemName, setItemName] = useState("");
  const [targetBuyPrice, setTargetBuyPrice] = useState("");
  const [targetSellPrice, setTargetSellPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<GEItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GEItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [livePrices, setLivePrices] = useState<Map<number, number>>(new Map());

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
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

  useEffect(() => {
    const fetchLivePrices = async () => {
      const newPrices = new Map<number, number>();
      for (const item of watchlist) {
        try {
          const response = await fetch(`/api/ge/price?name=${encodeURIComponent(item.itemName)}`);
          if (response.ok) {
            const data = await response.json();
            newPrices.set(item.itemId, data.price);
          }
        } catch {
        }
      }
      setLivePrices(newPrices);
    };

    if (watchlist.length > 0) {
      fetchLivePrices();
    }
  }, [watchlist]);

  const createMutation = useMutation({
    mutationFn: async (data: { itemId: number; itemName: string; itemIcon?: string; targetBuyPrice?: number; targetSellPrice?: number; notes?: string }) => {
      return await apiRequest("POST", "/api/watchlist", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Item added to watchlist" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Item removed from watchlist" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    },
  });

  const handleSelectItem = (item: GEItem) => {
    setItemName(item.name);
    setSelectedItem(item);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const resetForm = () => {
    setItemName("");
    setTargetBuyPrice("");
    setTargetSellPrice("");
    setNotes("");
    setSelectedItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    createMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemIcon: selectedItem.icon,
      targetBuyPrice: targetBuyPrice ? parseInt(targetBuyPrice) : undefined,
      targetSellPrice: targetSellPrice ? parseInt(targetSellPrice) : undefined,
      notes: notes || undefined,
    });
  };

  const formatPrice = (price: number) => price.toLocaleString();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading watchlist...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Watchlist
          </h1>
          <p className="text-muted-foreground">Track item prices without logging flips</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Add to Watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <div className="relative">
                      <Input
                        value={itemName}
                        onChange={(e) => {
                          setItemName(e.target.value);
                          setSelectedItem(null);
                        }}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Search for an item..."
                        data-testid="input-watchlist-item"
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
                              data-testid={`watchlist-suggestion-${item.id}`}
                            >
                              {item.icon && (
                                <img src={item.icon} alt={item.name} className="h-6 w-6 object-contain" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {formatPrice(item.price)} gp
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedItem && (
                      <div className="rounded-md border bg-muted/50 p-2 text-sm">
                        <div className="flex items-center gap-2">
                          {selectedItem.icon && (
                            <img src={selectedItem.icon} alt={selectedItem.name} className="h-5 w-5" />
                          )}
                          <span className="font-medium">{selectedItem.name}</span>
                          <span className="ml-auto font-mono text-success">
                            {formatPrice(selectedItem.price)} gp
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target Buy Price</Label>
                      <Input
                        type="number"
                        value={targetBuyPrice}
                        onChange={(e) => setTargetBuyPrice(e.target.value)}
                        placeholder="Optional"
                        className="font-mono"
                        data-testid="input-target-buy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Sell Price</Label>
                      <Input
                        type="number"
                        value={targetSellPrice}
                        onChange={(e) => setTargetSellPrice(e.target.value)}
                        placeholder="Optional"
                        className="font-mono"
                        data-testid="input-target-sell"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes..."
                      data-testid="input-notes"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={!selectedItem || createMutation.isPending}
                    data-testid="button-add-watchlist"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add to Watchlist
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {watchlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <Eye className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No items in watchlist</h3>
                <p className="text-sm text-muted-foreground">
                  Add items to track their prices without logging flips.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Item
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Target Buy
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Target Sell
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Notes
                        </th>
                        <th className="w-16 px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {watchlist.map((item, index) => {
                        const currentPrice = livePrices.get(item.itemId);
                        const isBelowBuy = item.targetBuyPrice && currentPrice && currentPrice <= item.targetBuyPrice;
                        const isAboveSell = item.targetSellPrice && currentPrice && currentPrice >= item.targetSellPrice;

                        return (
                          <tr
                            key={item.id}
                            className={`hover-elevate border-b transition-colors ${
                              index % 2 === 0 ? "bg-background" : "bg-card/50"
                            }`}
                            data-testid={`row-watchlist-${item.id}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <ItemIcon itemName={item.itemName} itemIcon={item.itemIcon ?? undefined} size="sm" />
                                <span className="font-medium">{item.itemName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {currentPrice ? (
                                <span className="text-success">{formatPrice(currentPrice)}</span>
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin inline" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {item.targetBuyPrice ? (
                                <span className={isBelowBuy ? "text-success font-semibold" : ""}>
                                  {formatPrice(item.targetBuyPrice)}
                                  {isBelowBuy && <TrendingDown className="h-4 w-4 inline ml-1" />}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {item.targetSellPrice ? (
                                <span className={isAboveSell ? "text-success font-semibold" : ""}>
                                  {formatPrice(item.targetSellPrice)}
                                  {isAboveSell && <TrendingUp className="h-4 w-4 inline ml-1" />}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                              {item.notes || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(item.id)}
                                data-testid={`button-delete-watchlist-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
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
        </div>
      </main>
    </div>
  );
}
