import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PriceAlert } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, Bell, BellOff, ArrowUp, ArrowDown, BellRing, CheckCircle } from "lucide-react";
import { ItemIcon } from "@/components/ItemIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GEItem {
  id: number;
  name: string;
  price: number;
  icon?: string;
}

export default function Alerts() {
  const { toast } = useToast();
  const [itemName, setItemName] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [alertType, setAlertType] = useState<"above" | "below">("below");
  const [suggestions, setSuggestions] = useState<GEItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GEItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [livePrices, setLivePrices] = useState<Map<number, number>>(new Map());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notifiedAlerts, setNotifiedAlerts] = useState<Set<string>>(new Set());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ["/api/alerts"],
  });

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Notifications not supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === "granted") {
        toast({
          title: "Notifications enabled",
          description: "You'll receive alerts when prices hit your targets",
        });
        new Notification("RS3 Flip Tracker", {
          body: "Price alerts are now enabled!",
          icon: "/favicon.ico",
        });
      } else if (permission === "denied") {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not request notification permission",
        variant: "destructive",
      });
    }
  };

  const sendPriceNotification = useCallback((alert: PriceAlert, currentPrice: number) => {
    if (notificationPermission !== "granted") return;
    if (notifiedAlerts.has(alert.id)) return;

    const direction = alert.alertType === "below" ? "dropped below" : "risen above";
    const body = `${alert.itemName} has ${direction} your target of ${alert.targetPrice.toLocaleString()} gp! Current price: ${currentPrice.toLocaleString()} gp`;

    try {
      new Notification("Price Alert Triggered!", {
        body,
        icon: alert.itemIcon || "/favicon.ico",
        tag: `price-alert-${alert.id}`,
        requireInteraction: true,
      });

      setNotifiedAlerts(prev => new Set(prev).add(alert.id));
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }, [notificationPermission, notifiedAlerts]);

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

  const fetchLivePricesAndCheck = useCallback(async () => {
    if (alerts.length === 0) return;

    const newPrices = new Map<number, number>();
    for (const alert of alerts) {
      try {
        const response = await fetch(`/api/ge/price?name=${encodeURIComponent(alert.itemName)}`);
        if (response.ok) {
          const data = await response.json();
          newPrices.set(alert.itemId, data.price);

          const isTriggered = alert.alertType === "below" 
            ? data.price <= alert.targetPrice
            : data.price >= alert.targetPrice;

          if (isTriggered && alert.isActive === 1) {
            sendPriceNotification(alert, data.price);
          }
        }
      } catch {
      }
    }
    setLivePrices(newPrices);
  }, [alerts, sendPriceNotification]);

  useEffect(() => {
    fetchLivePricesAndCheck();

    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    checkIntervalRef.current = setInterval(fetchLivePricesAndCheck, 60000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [fetchLivePricesAndCheck]);

  const createMutation = useMutation({
    mutationFn: async (data: { itemId: number; itemName: string; itemIcon?: string; alertType: "above" | "below"; targetPrice: number }) => {
      return await apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Price alert created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create alert", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Price alert deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete alert", variant: "destructive" });
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
    setTargetPrice("");
    setAlertType("below");
    setSelectedItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !targetPrice) return;

    createMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemIcon: selectedItem.icon,
      alertType,
      targetPrice: parseInt(targetPrice),
    });
  };

  const formatPrice = (price: number) => price.toLocaleString();

  const checkAlertTriggered = (alert: PriceAlert) => {
    const currentPrice = livePrices.get(alert.itemId);
    if (!currentPrice) return false;
    
    if (alert.alertType === "below") {
      return currentPrice <= alert.targetPrice;
    } else {
      return currentPrice >= alert.targetPrice;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading alerts...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Price Alerts
            </h1>
            <p className="text-muted-foreground">Get notified when item prices hit your targets</p>
          </div>
          
          <div className="flex items-center gap-2">
            {notificationPermission === "unsupported" ? (
              <Badge variant="secondary" className="gap-1">
                <BellOff className="h-3 w-3" />
                Notifications not supported
              </Badge>
            ) : notificationPermission === "granted" ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-success/10 text-success border-success/20 gap-1" data-testid="badge-notifications-enabled">
                  <CheckCircle className="h-3 w-3" />
                  Notifications enabled
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLivePricesAndCheck}
                  data-testid="button-check-prices"
                  title="Check prices now"
                >
                  <Loader2 className={`h-4 w-4 ${livePrices.size === 0 && alerts.length > 0 ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            ) : notificationPermission === "denied" ? (
              <Badge variant="destructive" className="gap-1">
                <BellOff className="h-3 w-3" />
                Notifications blocked
              </Badge>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={requestNotificationPermission}
                data-testid="button-enable-notifications"
              >
                <BellRing className="h-4 w-4 mr-2" />
                Enable Notifications
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Create Alert</CardTitle>
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
                        data-testid="input-alert-item"
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
                              data-testid={`alert-suggestion-${item.id}`}
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

                  <div className="space-y-2">
                    <Label>Alert When Price Goes</Label>
                    <Select value={alertType} onValueChange={(v) => setAlertType(v as "above" | "below")}>
                      <SelectTrigger data-testid="select-alert-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4 text-success" />
                            Below target (good to buy)
                          </div>
                        </SelectItem>
                        <SelectItem value="above">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4 text-destructive" />
                            Above target (good to sell)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Price</Label>
                    <Input
                      type="number"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="Enter target price"
                      className="font-mono"
                      data-testid="input-target-price"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={!selectedItem || !targetPrice || createMutation.isPending}
                    data-testid="button-create-alert"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Alert
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <BellOff className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No price alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Create alerts to track when item prices hit your targets.
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
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Type
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Target Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Current Price
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="w-16 px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alert, index) => {
                        const currentPrice = livePrices.get(alert.itemId);
                        const isTriggered = checkAlertTriggered(alert);

                        return (
                          <tr
                            key={alert.id}
                            className={`hover-elevate border-b transition-colors ${
                              index % 2 === 0 ? "bg-background" : "bg-card/50"
                            } ${isTriggered ? "bg-success/10" : ""}`}
                            data-testid={`row-alert-${alert.id}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <ItemIcon itemName={alert.itemName} itemIcon={alert.itemIcon ?? undefined} size="sm" />
                                <span className="font-medium">{alert.itemName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={alert.alertType === "below" ? "default" : "destructive"}>
                                {alert.alertType === "below" ? (
                                  <><ArrowDown className="h-3 w-3 mr-1" /> Below</>
                                ) : (
                                  <><ArrowUp className="h-3 w-3 mr-1" /> Above</>
                                )}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {formatPrice(alert.targetPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {currentPrice ? (
                                <span className="text-success">{formatPrice(currentPrice)}</span>
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin inline" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isTriggered ? (
                                <Badge className="bg-success text-success-foreground">
                                  <Bell className="h-3 w-3 mr-1" />
                                  Triggered
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Watching
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(alert.id)}
                                data-testid={`button-delete-alert-${alert.id}`}
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
                <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                  Prices auto-refresh every 60 seconds. {notificationPermission === "granted" 
                    ? "You'll receive browser notifications when alerts trigger."
                    : "Enable notifications to receive browser alerts."}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
