import { useState, useEffect, useRef } from "react";
import { FlipForm } from "@/components/FlipForm";
import { FlipCardGrid } from "@/components/FlipCardGrid";
import { GoalsProgress } from "@/components/GoalsProgress";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Flip, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

// Helper to get today's date key for localStorage tracking
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

// Get notified goals for today from localStorage
function getNotifiedGoalsToday(): Set<string> {
  try {
    const stored = localStorage.getItem('flipsync_notified_goals');
    if (!stored) return new Set();
    const data = JSON.parse(stored);
    if (data.date !== getTodayKey()) return new Set(); // Reset for new day
    return new Set(data.goals || []);
  } catch {
    return new Set();
  }
}

// Mark a goal as notified for today
function markGoalNotified(goalType: string): void {
  try {
    const notified = getNotifiedGoalsToday();
    notified.add(goalType);
    localStorage.setItem('flipsync_notified_goals', JSON.stringify({
      date: getTodayKey(),
      goals: Array.from(notified),
    }));
  } catch {
    // Ignore localStorage errors
  }
}

export default function Home() {
  const { toast } = useToast();
  const [selectedChart, setSelectedChart] = useState<{ itemId?: number; itemName: string } | null>(null);
  const [viewScope, setViewScope] = useState<'mine' | 'all'>('mine');
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const hasCheckedGoals = useRef(false);
  
  // Check for already-met goals on first page load (first-time-of-day celebration)
  useEffect(() => {
    if (hasCheckedGoals.current) return;
    hasCheckedGoals.current = true;
    
    const checkMetGoals = async () => {
      try {
        const res = await fetch('/api/goals/check-met', { credentials: 'include' });
        if (!res.ok) return;
        
        const data = await res.json();
        const notifiedToday = getNotifiedGoalsToday();
        
        for (const goal of data.metGoals || []) {
          // Skip if already notified today
          if (notifiedToday.has(goal.goalType)) continue;
          
          const goalLabels: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
          const goalLabel = goalLabels[goal.goalType as string] || goal.goalType;
          const profitFormatted = (goal.currentProfit / 1000000).toFixed(1);
          const targetFormatted = (goal.targetAmount / 1000000).toFixed(1);
          
          // Mark as notified
          markGoalNotified(goal.goalType);
          
          // Show celebration toast
          setTimeout(() => {
            toast({
              title: `🎉 ${goalLabel} Goal Already Met!`,
              description: `You're at ${profitFormatted}M / ${targetFormatted}M target. Keep it up!`,
              duration: 8000,
            });
          }, 1000);
          
          // Also send Discord notification for first-time detection today
          fetch('/api/goals/notify-achievement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              goalType: goal.goalType,
              targetAmount: goal.targetAmount,
              currentProfit: goal.currentProfit,
              username: goal.username,
              isFirstLoad: true,
            }),
          }).catch(() => {/* ignore errors */});
        }
      } catch (error) {
        console.error('[GoalCheck] Failed to check met goals:', error);
      }
    };
    
    // Small delay to ensure auth is ready
    setTimeout(checkMetGoals, 500);
  }, [toast]);
  
  // Check if current user is admin
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });
  const isAdmin = adminCheck?.isAdmin ?? false;

  // Fetch users list for admin filter dropdown
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin && viewScope === 'all',
  });

  // Build query key with scope and filter params
  const flipsQueryKey = isAdmin && viewScope === 'all' 
    ? filterUserId 
      ? ["/api/flips", { scope: 'all', userId: filterUserId }]
      : ["/api/flips", { scope: 'all' }]
    : ["/api/flips"];

  // Build query URL with params
  const flipsQueryUrl = isAdmin && viewScope === 'all'
    ? filterUserId
      ? `/api/flips?scope=all&userId=${filterUserId}`
      : `/api/flips?scope=all`
    : `/api/flips`;

  const { data: flips = [], isLoading } = useQuery<Flip[]>({
    queryKey: flipsQueryKey,
    queryFn: async () => {
      const res = await fetch(flipsQueryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch flips');
      return res.json();
    },
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip added",
        description: "Your flip has been logged successfully",
      });
      
      // Show celebration toasts for any achieved goals
      if (data?.achievements?.length > 0) {
        for (const achievement of data.achievements) {
          const goalLabel = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[achievement.goalType as string] || achievement.goalType;
          setTimeout(() => {
            toast({
              title: `🎉 ${goalLabel} Goal Achieved!`,
              description: `Congratulations! You've hit your ${goalLabel.toLowerCase()} profit target of ${(achievement.targetAmount / 1000000).toFixed(1)}M gp!`,
              duration: 10000,
            });
          }, 500);
        }
      }
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
    onSuccess: (responseData: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      toast({
        title: "Flip updated",
        description: "Your flip has been updated successfully",
      });
      
      // Show celebration toasts for any achieved goals
      if (responseData?.achievements?.length > 0) {
        for (const achievement of responseData.achievements) {
          const goalLabel = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[achievement.goalType as string] || achievement.goalType;
          setTimeout(() => {
            toast({
              title: `🎉 ${goalLabel} Goal Achieved!`,
              description: `Congratulations! You've hit your ${goalLabel.toLowerCase()} profit target of ${(achievement.targetAmount / 1000000).toFixed(1)}M gp!`,
              duration: 10000,
            });
          }, 500);
        }
      }
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
    membershipStatus: "F2P" | "Members" | "Unknown";
    rsAccountId?: string;
    isMembers?: boolean;
    geLimit?: number;
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

  const handleViewChart = (itemId: number | undefined, itemName: string) => {
    setSelectedChart({ itemId, itemName });
  };

  const GE_TAX_RATE = 0.02;

  const calculateGETax = (sellPrice: number, quantity: number) => {
    // 2% tax per item, floored, then multiplied by quantity
    const taxPerItem = Math.floor(sellPrice * GE_TAX_RATE);
    return taxPerItem * quantity;
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
      <div className="bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading flips...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {isAdmin && (
          <div className="mb-6 flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">View:</span>
            </div>
            <Select 
              value={viewScope} 
              onValueChange={(value: 'mine' | 'all') => {
                setViewScope(value);
                if (value === 'mine') setFilterUserId(null);
              }}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-view-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My Flips</SelectItem>
                <SelectItem value="all">All Users</SelectItem>
              </SelectContent>
            </Select>
            
            {viewScope === 'all' && (
              <>
                <span className="text-sm text-muted-foreground">Filter by user:</span>
                <Select 
                  value={filterUserId ?? 'all'} 
                  onValueChange={(value) => setFilterUserId(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-filter-user">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {allUsers.filter((user) => {
                      if (!user.email || !user.email.includes('@')) return false;
                      const testDomains = ['@example.com', '@test.com', '@localhost', '@replit.com'];
                      return !testDomains.some(domain => user.email?.toLowerCase().endsWith(domain));
                    }).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs">
                  {flips.length} flip{flips.length !== 1 ? 's' : ''}
                </Badge>
              </>
            )}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              {viewScope === 'all' ? 'Total Flips (All Users)' : 'Total Flips'}
            </div>
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
            <div className="text-sm text-muted-foreground">
              {viewScope === 'all' ? 'Total Profit (All Users)' : 'Total Profit'}
            </div>
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
              userFlips={flips}
            />
          </div>
        )}

        <div className="space-y-8">
          <FlipForm onSubmit={handleAddFlip} openPositions={openPositions} />
          
          <FlipCardGrid 
            flips={flips.map(flip => ({
              ...flip,
              itemIcon: flip.itemIcon ?? undefined,
              itemId: flip.itemId ?? undefined,
              sellPrice: flip.sellPrice ?? undefined,
              buyDate: new Date(flip.buyDate),
              sellDate: flip.sellDate ? new Date(flip.sellDate) : undefined,
              notes: flip.notes ?? undefined,
              category: flip.category ?? undefined,
              strategyTag: flip.strategyTag ?? undefined,
              membershipStatus: flip.membershipStatus ?? undefined,
              isMembers: flip.isMembers ?? undefined,
              geLimit: flip.geLimit ?? undefined,
            }))} 
            onDelete={handleDeleteFlip}
            onEdit={handleEditFlip}
            onQuickSell={handleQuickSell}
            onViewChart={handleViewChart}
          />
        </div>
      </main>
    </div>
  );
}
