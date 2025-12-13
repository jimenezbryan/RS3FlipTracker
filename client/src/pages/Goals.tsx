import { Header } from "@/components/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProfitGoal, Flip } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Calendar, CalendarDays, CalendarRange, Trash2, Plus, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GE_TAX_RATE = 0.02;
const GE_TAX_CAP = 5_000_000;

const calculateGETax = (sellPrice: number, quantity: number) => {
  const grossRevenue = sellPrice * quantity;
  const rawTax = grossRevenue * GE_TAX_RATE;
  return Math.min(rawTax, GE_TAX_CAP);
};

const calculateProfit = (flip: Flip) => {
  if (!flip.sellPrice) return 0;
  const grossRevenue = flip.sellPrice * flip.quantity;
  const tax = calculateGETax(flip.sellPrice, flip.quantity);
  const netRevenue = grossRevenue - tax;
  const totalCost = flip.buyPrice * flip.quantity;
  return netRevenue - totalCost;
};

export default function Goals() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [newGoalAmount, setNewGoalAmount] = useState("");

  const { data: goals = [], isLoading: goalsLoading } = useQuery<ProfitGoal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: flips = [], isLoading: flipsLoading } = useQuery<Flip[]>({
    queryKey: ["/api/flips"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: { goalType: string; targetAmount: number }) => {
      return await apiRequest("POST", "/api/goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setIsDialogOpen(false);
      setNewGoalAmount("");
      toast({
        title: "Goal created",
        description: "Your profit goal has been set",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, targetAmount }: { id: string; targetAmount: number }) => {
      return await apiRequest("PATCH", `/api/goals/${id}`, { targetAmount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Goal updated",
        description: "Your profit goal has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update goal",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Goal deleted",
        description: "Your profit goal has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete goal",
        variant: "destructive",
      });
    },
  });

  const profitByPeriod = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    let dailyProfit = 0;
    let weeklyProfit = 0;
    let monthlyProfit = 0;

    flips.forEach((flip) => {
      if (!flip.sellDate || !flip.sellPrice) return;
      const sellDate = new Date(flip.sellDate);
      const profit = calculateProfit(flip);

      if (isAfter(sellDate, dayStart) || sellDate.getTime() === dayStart.getTime()) {
        dailyProfit += profit;
      }
      if (isAfter(sellDate, weekStart) || sellDate.getTime() === weekStart.getTime()) {
        weeklyProfit += profit;
      }
      if (isAfter(sellDate, monthStart) || sellDate.getTime() === monthStart.getTime()) {
        monthlyProfit += profit;
      }
    });

    return { daily: dailyProfit, weekly: weeklyProfit, monthly: monthlyProfit };
  }, [flips]);

  const getGoalByType = (type: string) => goals.find((g) => g.goalType === type);

  const getFirstAvailableGoalType = (): "daily" | "weekly" | "monthly" | null => {
    const types: ("daily" | "weekly" | "monthly")[] = ["daily", "weekly", "monthly"];
    for (const type of types) {
      if (!getGoalByType(type)) {
        return type;
      }
    }
    return null;
  };

  const handleOpenDialog = (open: boolean) => {
    if (open) {
      const availableType = getFirstAvailableGoalType();
      if (availableType) {
        setNewGoalType(availableType);
      }
    }
    setIsDialogOpen(open);
  };

  const handleCreateGoal = () => {
    if (getGoalByType(newGoalType)) {
      toast({
        title: "Goal already exists",
        description: `A ${newGoalType} goal already exists. Delete it first to create a new one.`,
        variant: "destructive",
      });
      return;
    }
    const amount = parseInt(newGoalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid target amount",
        variant: "destructive",
      });
      return;
    }
    createGoalMutation.mutate({ goalType: newGoalType, targetAmount: amount });
  };

  const goalTypeConfig = {
    daily: { icon: Calendar, label: "Daily", color: "text-blue-500" },
    weekly: { icon: CalendarDays, label: "Weekly", color: "text-purple-500" },
    monthly: { icon: CalendarRange, label: "Monthly", color: "text-amber-500" },
  };

  const formatPrice = (price: number) => Math.round(price).toLocaleString();

  const isLoading = goalsLoading || flipsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="text-center text-muted-foreground">Loading goals...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-goals-title">
              Profit Goals
            </h2>
            <p className="text-muted-foreground">
              Set and track your daily, weekly, and monthly profit targets
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={handleOpenDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-goal" disabled={getFirstAvailableGoalType() === null}>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Profit Goal</DialogTitle>
                <DialogDescription>
                  Set a target profit amount for a specific time period
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="goalType">Goal Type</Label>
                  <Select value={newGoalType} onValueChange={(v) => setNewGoalType(v as "daily" | "weekly" | "monthly")}>
                    <SelectTrigger data-testid="select-goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily" disabled={!!getGoalByType("daily")}>
                        Daily Goal {getGoalByType("daily") && "(Already exists)"}
                      </SelectItem>
                      <SelectItem value="weekly" disabled={!!getGoalByType("weekly")}>
                        Weekly Goal {getGoalByType("weekly") && "(Already exists)"}
                      </SelectItem>
                      <SelectItem value="monthly" disabled={!!getGoalByType("monthly")}>
                        Monthly Goal {getGoalByType("monthly") && "(Already exists)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target Amount (gp)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    placeholder="e.g. 10000000"
                    value={newGoalAmount}
                    onChange={(e) => setNewGoalAmount(e.target.value)}
                    data-testid="input-goal-amount"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-goal">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateGoal} 
                  disabled={createGoalMutation.isPending}
                  data-testid="button-save-goal"
                >
                  Create Goal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {(["daily", "weekly", "monthly"] as const).map((type) => {
            const goal = getGoalByType(type);
            const config = goalTypeConfig[type];
            const currentProfit = profitByPeriod[type];
            const targetAmount = goal?.targetAmount ?? 0;
            const progress = targetAmount > 0 ? Math.min((currentProfit / targetAmount) * 100, 100) : 0;
            const isComplete = currentProfit >= targetAmount && targetAmount > 0;

            return (
              <Card key={type} data-testid={`card-goal-${type}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    <CardTitle className="text-lg">{config.label} Goal</CardTitle>
                  </div>
                  {isComplete && (
                    <Badge className="bg-success text-success-foreground">
                      <Check className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {goal ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progress.toFixed(1)}%</span>
                        </div>
                        <Progress value={progress} className="h-3" />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-mono text-xl font-bold ${currentProfit >= 0 ? "text-success" : "text-destructive"}`} data-testid={`text-current-profit-${type}`}>
                            {currentProfit >= 0 ? "+" : ""}{formatPrice(currentProfit)} gp
                          </div>
                          <div className="text-sm text-muted-foreground" data-testid={`text-target-amount-${type}`}>
                            of {formatPrice(targetAmount)} gp target
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteGoalMutation.mutate(goal.id)}
                          disabled={deleteGoalMutation.isPending}
                          data-testid={`button-delete-goal-${type}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="New target"
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const input = e.target as HTMLInputElement;
                                const value = parseInt(input.value);
                                if (!isNaN(value) && value > 0) {
                                  updateGoalMutation.mutate({ id: goal.id, targetAmount: value });
                                  input.value = "";
                                }
                              }
                            }}
                            data-testid={`input-update-goal-${type}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).parentElement?.querySelector("input") as HTMLInputElement;
                              const value = parseInt(input?.value ?? "");
                              if (!isNaN(value) && value > 0) {
                                updateGoalMutation.mutate({ id: goal.id, targetAmount: value });
                                input.value = "";
                              }
                            }}
                            data-testid={`button-update-goal-${type}`}
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-4 rounded-full bg-muted p-3">
                        <Target className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        No {type} goal set
                      </p>
                      <div className="text-xs text-muted-foreground mb-4">
                        Current {type} profit:{" "}
                        <span className={`font-mono font-medium ${currentProfit >= 0 ? "text-success" : "text-destructive"}`}>
                          {currentProfit >= 0 ? "+" : ""}{formatPrice(currentProfit)} gp
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewGoalType(type);
                          setIsDialogOpen(true);
                        }}
                        data-testid={`button-set-${type}-goal`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Set {config.label} Goal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Profit Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Today's Profit</div>
                <div className={`mt-2 font-mono text-2xl font-bold ${profitByPeriod.daily >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-daily-profit-summary">
                  {profitByPeriod.daily >= 0 ? "+" : ""}{formatPrice(profitByPeriod.daily)} gp
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">This Week</div>
                <div className={`mt-2 font-mono text-2xl font-bold ${profitByPeriod.weekly >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-weekly-profit-summary">
                  {profitByPeriod.weekly >= 0 ? "+" : ""}{formatPrice(profitByPeriod.weekly)} gp
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">This Month</div>
                <div className={`mt-2 font-mono text-2xl font-bold ${profitByPeriod.monthly >= 0 ? "text-success" : "text-destructive"}`} data-testid="text-monthly-profit-summary">
                  {profitByPeriod.monthly >= 0 ? "+" : ""}{formatPrice(profitByPeriod.monthly)} gp
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
