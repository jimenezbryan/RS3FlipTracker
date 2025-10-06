import { ArrowDownIcon, ArrowUpIcon, Trash2 } from "lucide-react";
import { ItemIcon } from "./ItemIcon";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

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

interface FlipTableProps {
  flips: Flip[];
  onDelete: (id: string) => void;
}

export function FlipTable({ flips, onDelete }: FlipTableProps) {
  const calculateProfit = (flip: Flip) => {
    if (!flip.sellPrice) return null;
    return (flip.sellPrice - flip.buyPrice) * flip.quantity;
  };

  const calculateROI = (flip: Flip) => {
    if (!flip.sellPrice) return null;
    const profitPerItem = flip.sellPrice - flip.buyPrice;
    return ((profitPerItem / flip.buyPrice) * 100).toFixed(2);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString();
  };

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
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Item
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Buy Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sell Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Profit
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ROI %
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dates
              </th>
              <th className="w-12 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {flips.map((flip, index) => {
              const profit = calculateProfit(flip);
              const roi = calculateROI(flip);
              const isProfit = profit !== null && profit > 0;
              const isLoss = profit !== null && profit < 0;

              return (
                <tr
                  key={flip.id}
                  className={`hover-elevate border-b transition-colors ${
                    index % 2 === 0 ? "bg-background" : "bg-card/50"
                  }`}
                  data-testid={`row-flip-${flip.id}`}
                >
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
                      <div className="flex items-center justify-end gap-1">
                        {isProfit && <ArrowUpIcon className="h-4 w-4 text-success" />}
                        {isLoss && <ArrowDownIcon className="h-4 w-4 text-destructive" />}
                        <span
                          className={`font-mono text-sm font-medium ${
                            isProfit ? "text-success" : isLoss ? "text-destructive" : ""
                          }`}
                        >
                          {profit > 0 ? "+" : ""}{formatPrice(profit)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {roi !== null ? (
                      <span
                        className={`font-mono text-sm font-semibold ${
                          parseFloat(roi) > 0 ? "text-success" : parseFloat(roi) < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {parseFloat(roi) > 0 ? "+" : ""}{roi}%
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(flip.id)}
                      data-testid={`button-delete-${flip.id}`}
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
  );
}
