import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Search, Loader2, TrendingUp } from "lucide-react";

interface GEItem {
  id: number;
  name: string;
  price: number;
  volume?: number;
  icon?: string;
}

interface FlipFormProps {
  onSubmit: (flip: {
    itemName: string;
    itemIcon?: string;
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }) => void;
}

export function FlipForm({ onSubmit }: FlipFormProps) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [sellDate, setSellDate] = useState("");
  
  const [gePrice, setGePrice] = useState<GEItem | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const handleLookup = async () => {
    if (!itemName.trim()) return;
    
    setIsLookingUp(true);
    setLookupError("");
    setGePrice(null);
    
    try {
      const response = await fetch(`/api/ge/price?name=${encodeURIComponent(itemName)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setLookupError("Item not found in Grand Exchange");
        } else {
          setLookupError("Failed to fetch price");
        }
        return;
      }
      
      const data: GEItem = await response.json();
      setGePrice(data);
      setItemName(data.name || itemName);
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
      quantity: parseInt(quantity),
      buyPrice: parseInt(buyPrice),
      sellPrice: sellPrice ? parseInt(sellPrice) : undefined,
      buyDate: new Date(buyDate),
      sellDate: sellDate ? new Date(sellDate) : undefined,
    });

    setItemName("");
    setQuantity("1");
    setBuyPrice("");
    setSellPrice("");
    setBuyDate(new Date().toISOString().split('T')[0]);
    setSellDate("");
    setGePrice(null);
    setLookupError("");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Log Flip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemName">Item Name</Label>
            <div className="flex gap-2">
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setGePrice(null);
                  setLookupError("");
                }}
                placeholder="e.g., Abyssal whip"
                data-testid="input-item-name"
                required
              />
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
            
            {lookupError && (
              <p className="text-sm text-destructive">{lookupError}</p>
            )}
            
            {gePrice && (
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
                    {gePrice.volume && (
                      <div className="text-xs text-muted-foreground">
                        Volume: {gePrice.volume.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyDate">Buy Date</Label>
              <div className="relative">
                <Input
                  id="buyDate"
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  data-testid="input-buy-date"
                  required
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellDate">Sell Date</Label>
              <div className="relative">
                <Input
                  id="sellDate"
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  data-testid="input-sell-date"
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" data-testid="button-add-flip">
            Add Flip
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
