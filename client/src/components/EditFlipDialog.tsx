import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Flip {
  id: string;
  itemName: string;
  itemIcon?: string;
  quantity: number;
  buyPrice: number;
  sellPrice?: number;
  buyDate: Date;
  sellDate?: Date;
  notes?: string;
  category?: string;
}

interface EditFlipDialogProps {
  flip: Flip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<{
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
    notes?: string;
    category?: string;
  }>) => void;
}

const CATEGORIES = ["High Value", "Consumables", "Weapons", "Armor", "Skilling", "Misc"];

export function EditFlipDialog({ flip, open, onOpenChange, onSubmit }: EditFlipDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyDate, setBuyDate] = useState<Date>(new Date());
  const [sellDate, setSellDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [buyDateOpen, setBuyDateOpen] = useState(false);
  const [sellDateOpen, setSellDateOpen] = useState(false);

  useEffect(() => {
    if (flip) {
      setQuantity(flip.quantity.toString());
      setBuyPrice(flip.buyPrice.toString());
      setSellPrice(flip.sellPrice?.toString() ?? "");
      setBuyDate(new Date(flip.buyDate));
      setSellDate(flip.sellDate ? new Date(flip.sellDate) : undefined);
      setNotes(flip.notes ?? "");
      setCategory(flip.category ?? "");
    }
  }, [flip]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      quantity: parseInt(quantity),
      buyPrice: parseInt(buyPrice),
      sellPrice: sellPrice ? parseInt(sellPrice) : undefined,
      buyDate,
      sellDate,
      notes: notes || undefined,
      category: category || undefined,
    });
  };

  const setQuickDate = (type: 'buy' | 'sell', preset: 'today' | 'yesterday' | 'week' | 'clear') => {
    if (preset === 'clear') {
      if (type === 'sell') {
        setSellDate(undefined);
        setSellDateOpen(false);
      }
      return;
    }

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

  if (!flip) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Flip</DialogTitle>
          <DialogDescription>
            Edit the details for {flip.itemName}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="font-mono"
              data-testid="input-edit-quantity"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-buyPrice">Buy Price</Label>
              <Input
                id="edit-buyPrice"
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="font-mono"
                data-testid="input-edit-buy-price"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sellPrice">Sell Price</Label>
              <Input
                id="edit-sellPrice"
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="font-mono"
                data-testid="input-edit-sell-price"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Buy Date</Label>
              <Popover open={buyDateOpen} onOpenChange={setBuyDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !buyDate && "text-muted-foreground"
                    )}
                    data-testid="button-edit-buy-date"
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
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('buy', 'yesterday')}
                    >
                      Yesterday
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
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !sellDate && "text-muted-foreground"
                    )}
                    data-testid="button-edit-sell-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {sellDate ? format(sellDate, "MMM d, yyyy") : "Not sold"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('sell', 'today')}
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickDate('sell', 'clear')}
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

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-edit-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this flip..."
              className="resize-none"
              rows={2}
              data-testid="input-edit-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-edit-cancel">
              Cancel
            </Button>
            <Button type="submit" data-testid="button-edit-save">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
