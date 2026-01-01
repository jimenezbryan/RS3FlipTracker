import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowUpDown, TrendingUp, TrendingDown, Package } from "lucide-react";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItemSummary {
  itemName: string;
  itemId: number | null;
  itemIcon: string | null;
  totalProfit: number;
  totalQuantity: number;
  tradeCount: number;
  avgROI: number;
  winRate: number;
  avgHoldTime: number;
}

type SortField = "totalProfit" | "tradeCount" | "avgROI" | "winRate" | "totalQuantity";
type SortDirection = "asc" | "desc";

function formatGp(value: number): string {
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function ItemLeaderboard() {
  const [sortField, setSortField] = useState<SortField>("totalProfit");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: items = [], isLoading } = useQuery<ItemSummary[]>({
    queryKey: ["/api/stats/item-summary"],
  });

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [items, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover-elevate" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className={`h-3 w-3 ${sortDirection === "asc" ? "rotate-180" : ""}`} />
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card data-testid="card-item-leaderboard">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Item Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Loading item stats...</div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card data-testid="card-item-leaderboard">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Item Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No completed trades yet</p>
            <p className="text-sm">Complete some flips to see your item performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-item-leaderboard">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Item Leaderboard
        </CardTitle>
        <Badge variant="secondary" className="font-mono">
          {items.length} items
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Item</TableHead>
                <SortableHeader field="totalProfit">Profit</SortableHeader>
                <SortableHeader field="tradeCount">Trades</SortableHeader>
                <SortableHeader field="totalQuantity">Qty</SortableHeader>
                <SortableHeader field="avgROI">Avg ROI</SortableHeader>
                <SortableHeader field="winRate">Win Rate</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, index) => (
                <TableRow key={item.itemName} data-testid={`row-item-${index}`}>
                  <TableCell className="font-mono text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.itemIcon && (
                        <img 
                          src={item.itemIcon} 
                          alt={item.itemName}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <span className="font-medium truncate max-w-[200px]" title={item.itemName}>
                        {item.itemName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span 
                      className={`font-mono font-medium flex items-center gap-1 ${
                        item.totalProfit >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {item.totalProfit >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {item.totalProfit >= 0 ? "+" : ""}{formatGp(item.totalProfit)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{item.tradeCount}</TableCell>
                  <TableCell className="font-mono">{item.totalQuantity.toLocaleString()}</TableCell>
                  <TableCell>
                    <span 
                      className={`font-mono ${
                        item.avgROI >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {item.avgROI >= 0 ? "+" : ""}{item.avgROI.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={item.winRate >= 70 ? "default" : item.winRate >= 50 ? "secondary" : "destructive"}
                      className="font-mono"
                    >
                      {item.winRate.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
