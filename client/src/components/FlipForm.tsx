import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Search, Loader2, TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown, Clock, Upload, Camera, X } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface GEItem {
  id: number;
  name: string;
  price: number;
  volume?: number;
  icon?: string;
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
  const [buyDate, setBuyDate] = useState<Date>(new Date());
  const [sellDate, setSellDate] = useState<Date | undefined>(undefined);
  const [buyDateOpen, setBuyDateOpen] = useState(false);
  const [sellDateOpen, setSellDateOpen] = useState(false);
  
  const [gePrice, setGePrice] = useState<GEItem | null>(null);
  const [priceTrend, setPriceTrend] = useState<PriceTrend | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      if (data.id) {
        const trendResponse = await fetch(`/api/ge/trend/${data.id}`);
        if (trendResponse.ok) {
          const trendData: PriceTrend = await trendResponse.json();
          setPriceTrend(trendData);
        }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setOcrError("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOcrPreview(base64);
      setOcrError("");
      setIsOcrProcessing(true);

      try {
        const response = await fetch('/api/flips/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          throw new Error('OCR processing failed');
        }

        const data = await response.json();
        
        if (data.itemName) setItemName(data.itemName);
        if (data.quantity) setQuantity(data.quantity.toString());
        if (data.buyPrice) setBuyPrice(data.buyPrice.toString());
        if (data.sellPrice) setSellPrice(data.sellPrice.toString());
        if (data.buyDate) setBuyDate(new Date(data.buyDate));
        if (data.sellDate) setSellDate(new Date(data.sellDate));

      } catch (error) {
        setOcrError("Could not extract data from image. Please fill manually.");
      } finally {
        setIsOcrProcessing(false);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearOcrPreview = () => {
    setOcrPreview(null);
    setOcrError("");
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
      buyDate: buyDate,
      sellDate: sellDate,
    });

    setItemName("");
    setQuantity("1");
    setBuyPrice("");
    setSellPrice("");
    setBuyDate(new Date());
    setSellDate(undefined);
    setGePrice(null);
    setPriceTrend(null);
    setLookupError("");
    setOcrPreview(null);
    setOcrError("");
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Log Flip</CardTitle>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-screenshot-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isOcrProcessing}
              data-testid="button-upload-screenshot"
            >
              {isOcrProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {isOcrProcessing ? "Processing..." : "Scan Screenshot"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {ocrPreview && (
          <div className="mb-4 relative">
            <div className="rounded-md border overflow-hidden bg-muted/50">
              <img 
                src={ocrPreview} 
                alt="Screenshot preview" 
                className="w-full max-h-32 object-contain"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={clearOcrPreview}
              data-testid="button-clear-screenshot"
            >
              <X className="h-4 w-4" />
            </Button>
            {isOcrProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}

        {ocrError && (
          <p className="text-sm text-destructive mb-4">{ocrError}</p>
        )}

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
                  setPriceTrend(null);
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
                      {gePrice.volume && (
                        <div className="text-xs text-muted-foreground">
                          Volume: {gePrice.volume.toLocaleString()}
                        </div>
                      )}
                    </div>
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

          <Button type="submit" className="w-full" data-testid="button-add-flip">
            Add Flip
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
