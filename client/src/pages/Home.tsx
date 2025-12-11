import { Header } from "@/components/Header";
import { FlipForm } from "@/components/FlipForm";
import { FlipTable } from "@/components/FlipTable";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Flip } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  
  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const createFlipMutation = useMutation({
    mutationFn: async (flipData: {
      itemName: string;
      itemIcon?: string;
      quantity: number;
      buyPrice: number;
      sellPrice?: number;
      buyDate: Date;
      sellDate?: Date;
    }) => {
      return await apiRequest("POST", "/api/flips", flipData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip added",
        description: "Your flip has been logged successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add flip",
        variant: "destructive",
      });
    },
  });

  const deleteFlipMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/flips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip deleted",
        description: "Your flip has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete flip",
        variant: "destructive",
      });
    },
  });

  const handleAddFlip = (flipData: {
    itemName: string;
    itemIcon?: string;
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
  }) => {
    createFlipMutation.mutate(flipData);
  };

  const handleDeleteFlip = (id: string) => {
    deleteFlipMutation.mutate(id);
  };

  const GE_TAX_RATE = 0.02;
  const GE_TAX_CAP = 5_000_000;

  const calculateGETax = (sellPrice: number, quantity: number) => {
    const grossRevenue = sellPrice * quantity;
    const rawTax = grossRevenue * GE_TAX_RATE;
    return Math.min(rawTax, GE_TAX_CAP);
  };

  const totalProfit = flips.reduce((sum, flip) => {
    if (flip.sellPrice) {
      const grossRevenue = flip.sellPrice * flip.quantity;
      const tax = calculateGETax(flip.sellPrice, flip.quantity);
      const netRevenue = grossRevenue - tax;
      const totalCost = flip.buyPrice * flip.quantity;
      return sum + (netRevenue - totalCost);
    }
    return sum;
  }, 0);

  const totalTaxPaid = flips.reduce((sum, flip) => {
    if (flip.sellPrice) {
      return sum + calculateGETax(flip.sellPrice, flip.quantity);
    }
    return sum;
  }, 0);

  const completedFlips = flips.filter((flip) => flip.sellPrice).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading flips...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Flips</div>
            <div className="mt-2 text-2xl font-semibold" data-testid="text-total-flips">
              {flips.length}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="mt-2 text-2xl font-semibold" data-testid="text-completed-flips">
              {completedFlips}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Profit</div>
            <div
              className={`mt-2 font-mono text-2xl font-semibold ${
                totalProfit > 0 ? "text-success" : totalProfit < 0 ? "text-destructive" : ""
              }`}
              data-testid="text-total-profit"
            >
              {totalProfit > 0 ? "+" : ""}{Math.round(totalProfit).toLocaleString()}
            </div>
            {totalTaxPaid > 0 && (
              <div className="mt-1 text-xs text-muted-foreground font-mono" data-testid="text-total-tax">
                -{Math.round(totalTaxPaid).toLocaleString()} tax paid
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <FlipForm onSubmit={handleAddFlip} />
          </div>
          <div className="lg:col-span-2">
            <FlipTable 
              flips={flips.map(flip => ({
                ...flip,
                itemIcon: flip.itemIcon ?? undefined,
                sellPrice: flip.sellPrice ?? undefined,
                buyDate: new Date(flip.buyDate),
                sellDate: flip.sellDate ? new Date(flip.sellDate) : undefined,
              }))} 
              onDelete={handleDeleteFlip} 
            />
          </div>
        </div>
      </main>
    </div>
  );
}
