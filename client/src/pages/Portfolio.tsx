import { Header } from "@/components/Header";
import { useQuery } from "@tanstack/react-query";
import type { Flip } from "@shared/schema";
import { ItemIcon } from "@/components/ItemIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, TrendingUp, Package, Coins } from "lucide-react";

export default function Portfolio() {
  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const openPositions = flips.filter((flip) => !flip.sellPrice);

  const totalInvestment = openPositions.reduce(
    (sum, flip) => sum + flip.buyPrice * flip.quantity,
    0
  );

  const totalItems = openPositions.reduce((sum, flip) => sum + flip.quantity, 0);

  const uniqueItems = new Set(openPositions.map((flip) => flip.itemName)).size;

  const positionsByCategory = openPositions.reduce((acc, flip) => {
    const category = flip.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(flip);
    return acc;
  }, {} as Record<string, typeof openPositions>);

  const formatPrice = (price: number) => price.toLocaleString();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading portfolio...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-portfolio-title">
            Portfolio
          </h2>
          <p className="text-muted-foreground">
            Your open positions and current investments
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Investment
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-bold" data-testid="text-total-investment">
                {formatPrice(totalInvestment)} gp
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Positions
              </CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-open-positions">
                {openPositions.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-items">
                {formatPrice(totalItems)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Items
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-unique-items">
                {uniqueItems}
              </div>
            </CardContent>
          </Card>
        </div>

        {openPositions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No open positions</h3>
              <p className="text-sm text-muted-foreground">
                All your flips have been completed. Add a new flip to start tracking.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(positionsByCategory)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, positions]) => {
                const categoryInvestment = positions.reduce(
                  (sum, flip) => sum + flip.buyPrice * flip.quantity,
                  0
                );
                const categoryItems = positions.reduce(
                  (sum, flip) => sum + flip.quantity,
                  0
                );

                return (
                  <Card key={category} data-testid={`card-category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{category}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {positions.length} position{positions.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatPrice(categoryItems)} items</span>
                        <span className="font-mono font-medium text-foreground">
                          {formatPrice(categoryInvestment)} gp invested
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {positions
                          .sort((a, b) => b.buyPrice * b.quantity - a.buyPrice * a.quantity)
                          .map((flip) => {
                            const investment = flip.buyPrice * flip.quantity;
                            return (
                              <div
                                key={flip.id}
                                className="flex items-center gap-4 rounded-lg border bg-card/50 p-4 hover-elevate"
                                data-testid={`position-${flip.id}`}
                              >
                                <ItemIcon
                                  itemName={flip.itemName}
                                  itemIcon={flip.itemIcon ?? undefined}
                                  size="md"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" title={flip.itemName}>
                                    {flip.itemName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {flip.quantity}x @ {formatPrice(flip.buyPrice)} gp
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Bought {formatDistanceToNow(new Date(flip.buyDate), { addSuffix: true })}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-semibold">
                                    {formatPrice(investment)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">gp</div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}
