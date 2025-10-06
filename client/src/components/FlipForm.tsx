import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";

interface FlipFormProps {
  onSubmit: (flip: {
    itemName: string;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }) => void;
}

export function FlipForm({ onSubmit }: FlipFormProps) {
  const [itemName, setItemName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [sellDate, setSellDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemName || !buyPrice || !buyDate) return;

    onSubmit({
      itemName,
      buyPrice: parseInt(buyPrice),
      sellPrice: sellPrice ? parseInt(sellPrice) : undefined,
      buyDate: new Date(buyDate),
      sellDate: sellDate ? new Date(sellDate) : undefined,
    });

    // Reset form
    setItemName("");
    setBuyPrice("");
    setSellPrice("");
    setBuyDate(new Date().toISOString().split('T')[0]);
    setSellDate("");
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
            <Input
              id="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Abyssal whip"
              data-testid="input-item-name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyPrice">Buy Price</Label>
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
              <Label htmlFor="sellPrice">Sell Price</Label>
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
