import { useState } from "react";
import { Header } from "@/components/Header";
import { FlipForm } from "@/components/FlipForm";
import { FlipTable } from "@/components/FlipTable";
import { GoalsProgress } from "@/components/GoalsProgress";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Flip } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function Home() {
  const { toast } = useToast();
  const [selectedChart, setSelectedChart] = useState<{ itemId: number; itemName: string } | null>(null);
  
  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const createFlipMutation = useMutation({
    mutationFn: async (flipData: {
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
      strategyTag: "Fast Flip" | "Slow Flip" | "Bulk" | "High Margin" | "Speculative" | "Other";
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

  const restoreFlipMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/flips/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip restored",
        description: "Your flip has been restored",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore flip",
        variant: "destructive",
      });
    },
  });

  const deleteFlipMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/flips/${id}?soft=true`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip deleted",
        description: "Your flip has been removed",
        action: (
          <ToastAction 
            altText="Undo delete" 
            onClick={() => restoreFlipMutation.mutate(deletedId)}
            data-testid="button-undo-delete"
          >
            Undo
          </ToastAction>
        ),
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

  const updateFlipMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{
      quantity: number;
      buyPrice: number;
      sellPrice?: number;
      buyDate: Date;
      sellDate?: Date;
      notes?: string;
      category?: string;
    }> }) => {
      return await apiRequest("PATCH", `/api/flips/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip updated",
        description: "Your flip has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update flip",
        variant: "destructive",
      });
    },
  });

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await apiRequest("DELETE", `/api/flips/${id}?soft=true`);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
    toast({
      title: "Flips deleted",
      description: `${ids.length} flip(s) have been removed`,
      action: (
        <ToastAction 
          altText="Undo delete" 
          onClick={async () => {
            for (const id of ids) {
              await apiRequest("POST", `/api/flips/${id}/restore`);
            }
            queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
            toast({
              title: "Flips restored",
              description: `${ids.length} flip(s) have been restored`,
            });
          }}
          data-testid="button-undo-bulk-delete"
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const handleAddFlip = (flipData: {
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
    strategyTag: "Fast Flip" | "Slow Flip" | "Bulk" | "High Margin" | "Speculative" | "Other";
  }) => {
    createFlipMutation.mutate(flipData);
  };

  const handleDeleteFlip = (id: string) => {
    deleteFlipMutation.mutate(id);
  };

  const handleEditFlip = (id: string, data: Partial<{
    quantity: number;
    buyPrice: number;
    sellPrice?: number;
    buyDate: Date;
    sellDate?: Date;
    notes?: string;
    category?: string;
  }>) => {
    updateFlipMutation.mutate({ id, data });
  };

  const handleQuickSell = async (id: string, itemName: string) => {
    try {
      const response = await fetch(`/api/ge/price?name=${encodeURIComponent(itemName)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch current price");
      }
      const priceData = await response.json();
      
      await apiRequest("PATCH", `/api/flips/${id}`, {
        sellPrice: priceData.price,
        sellDate: new Date().toISOString(),
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Quick sell completed",
        description: `Sold at current GE price: ${priceData.price.toLocaleString()} gp`,
      });
    } catch (error) {
      toast({
        title: "Quick sell failed",
        description: "Could not complete quick sell",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleViewChart = (itemId: number, itemName: string) => {
    setSelectedChart({ itemId, itemName });
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

  const openPositions = flips
    .filter((flip) => !flip.sellPrice)
    .map((flip) => ({
      id: flip.id,
      itemName: flip.itemName,
      quantity: flip.quantity,
      buyPrice: flip.buyPrice,
      buyDate: new Date(flip.buyDate),
    }));

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

        <GoalsProgress flips={flips} />

        {selectedChart && (
          <div className="mb-8">
            <PriceHistoryChart
              itemId={selectedChart.itemId}
              itemName={selectedChart.itemName}
              onClose={() => setSelectedChart(null)}
            />
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <FlipForm onSubmit={handleAddFlip} openPositions={openPositions} />
          </div>
          <div className="lg:col-span-2">
            <FlipTable 
              flips={flips.map(flip => ({
                ...flip,
                itemIcon: flip.itemIcon ?? undefined,
                itemId: flip.itemId ?? undefined,
                sellPrice: flip.sellPrice ?? undefined,
                buyDate: new Date(flip.buyDate),
                sellDate: flip.sellDate ? new Date(flip.sellDate) : undefined,
                notes: flip.notes ?? undefined,
                category: flip.category ?? undefined,
              }))} 
              onDelete={handleDeleteFlip}
              onEdit={handleEditFlip}
              onBulkDelete={handleBulkDelete}
              onQuickSell={handleQuickSell}
              onViewChart={handleViewChart}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
