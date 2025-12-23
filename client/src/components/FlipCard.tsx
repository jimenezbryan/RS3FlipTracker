import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trash2, Pencil, Zap, Loader2, LineChart, Tag, Clock, CalendarDays } from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateFlipTax, formatGp } from "@shared/taxCalculator";

interface FlipUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

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
  user?: FlipUser;
}

interface FlipCardProps {
  flip: Flip;
  onDelete?: (id: string) => void;
  onEdit?: (flip: Flip) => void;
  onQuickSell?: (id: string, itemName: string) => Promise<void>;
  onViewChart?: (itemId: number, itemName: string) => void;
}

function getFlipTaxDetails(flip: Flip) {
  if (!flip.sellPrice) return null;
  return calculateFlipTax(flip.sellPrice, flip.buyPrice, flip.quantity, flip.itemId, flip.itemName);
}

function formatPrice(price: number) {
  if (price >= 1_000_000_000) {
    return `${(price / 1_000_000_000).toFixed(2)}B`;
  }
  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(2)}M`;
  }
  if (price >= 1_000) {
    return `${(price / 1_000).toFixed(1)}K`;
  }
  return price.toLocaleString();
}

function formatFullPrice(price: number) {
  return price.toLocaleString();
}

export function FlipCard({ flip, onDelete, onEdit, onQuickSell, onViewChart }: FlipCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQuickSelling, setIsQuickSelling] = useState(false);

  const taxDetails = getFlipTaxDetails(flip);
  const profit = taxDetails?.profit ?? null;
  const roi = taxDetails?.roi ?? null;
  const isCompleted = flip.sellPrice !== undefined && flip.sellPrice !== null;
  const isProfitable = profit !== null && profit > 0;
  const tax = taxDetails?.totalTax ?? null;

  const handleQuickSell = async () => {
    if (!onQuickSell || isCompleted) return;
    setIsQuickSelling(true);
    try {
      await onQuickSell(flip.id, flip.itemName);
    } finally {
      setIsQuickSelling(false);
    }
  };

  const investment = flip.buyPrice * flip.quantity;
  const holdTime = flip.sellDate && flip.buyDate
    ? formatDistanceToNow(new Date(flip.buyDate), { addSuffix: false })
    : null;

  return (
    <Card 
      className={cn(
        "relative overflow-visible transition-all duration-200",
        isExpanded && "ring-1 ring-border"
      )}
      data-testid={`flip-card-${flip.id}`}
    >
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`flip-card-toggle-${flip.id}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <ItemIcon
              itemIcon={flip.itemIcon}
              itemName={flip.itemName}
              size="md"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm truncate" data-testid={`flip-item-name-${flip.id}`}>
                {flip.itemName}
              </h3>
              {flip.quantity > 1 && (
                <span className="text-xs text-muted-foreground">x{flip.quantity.toLocaleString()}</span>
              )}
              {!isCompleted && (
                <Badge variant="outline" className="text-xs h-5 bg-warning/10 text-warning border-warning/30">
                  Open
                </Badge>
              )}
              {flip.user && (
                <Badge variant="secondary" className="text-xs h-5" data-testid={`flip-user-${flip.id}`}>
                  {flip.user.firstName || flip.user.email?.split('@')[0] || 'User'}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Buy: <span className="font-mono text-foreground">{formatPrice(flip.buyPrice)}</span></span>
              {isCompleted && (
                <span>Sell: <span className="font-mono text-foreground">{formatPrice(flip.sellPrice!)}</span></span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {isCompleted && profit !== null ? (
              <>
                <Badge 
                  variant={isProfitable ? "default" : "destructive"}
                  className={cn(
                    "font-mono text-sm h-6 px-2",
                    isProfitable && "bg-success text-success-foreground hover:bg-success/90"
                  )}
                  data-testid={`flip-profit-${flip.id}`}
                >
                  {isProfitable ? "+" : ""}{formatPrice(profit)}
                </Badge>
                <span className={cn(
                  "text-xs font-mono",
                  isProfitable ? "text-success" : "text-destructive"
                )}>
                  {roi !== null && `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% ROI`}
                </span>
              </>
            ) : (
              <div className="text-xs text-muted-foreground font-mono">
                -{formatPrice(investment)} invested
              </div>
            )}
          </div>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span>Bought:</span>
                    <span className="text-foreground">{format(new Date(flip.buyDate), "MMM d, yyyy")}</span>
                  </div>
                  {flip.sellDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>Sold:</span>
                      <span className="text-foreground">{format(new Date(flip.sellDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  {holdTime && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Hold time:</span>
                      <span className="text-foreground">{holdTime}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {tax !== null && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>GE Tax:</span>
                      <span className="text-foreground font-mono">-{formatPrice(tax)}</span>
                    </div>
                  )}
                  {flip.geLimit && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>GE Limit:</span>
                      <span className="text-foreground font-mono">{flip.geLimit.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Investment:</span>
                    <span className="text-foreground font-mono">{formatFullPrice(investment)}</span>
                  </div>
                </div>
              </div>

              {(flip.category || flip.membershipStatus) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {flip.category && (
                    <Badge variant="secondary" className="text-xs h-5">
                      <Tag className="h-3 w-3 mr-1" />
                      {flip.category}
                    </Badge>
                  )}
                  {flip.membershipStatus && flip.membershipStatus !== "Unknown" && (
                    <Badge 
                      variant={flip.membershipStatus === "Members" ? "secondary" : "outline"} 
                      className="text-xs h-5"
                    >
                      {flip.membershipStatus}
                    </Badge>
                  )}
                </div>
              )}

              {flip.notes && (
                <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                  {flip.notes}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                {!isCompleted && onQuickSell && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickSell();
                    }}
                    disabled={isQuickSelling}
                    className="h-8"
                    data-testid={`button-quick-sell-${flip.id}`}
                  >
                    {isQuickSelling ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    Quick Sell
                  </Button>
                )}
                
                {flip.itemId && onViewChart && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewChart(flip.itemId!, flip.itemName);
                    }}
                    className="h-8"
                    data-testid={`button-view-chart-${flip.id}`}
                  >
                    <LineChart className="h-3 w-3 mr-1" />
                    Chart
                  </Button>
                )}

                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(flip);
                    }}
                    className="h-8"
                    data-testid={`button-edit-flip-${flip.id}`}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}

                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(flip.id);
                    }}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid={`button-delete-flip-${flip.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
