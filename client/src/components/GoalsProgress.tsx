import { useQuery } from "@tanstack/react-query";
import type { ProfitGoal, Flip } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Calendar, CalendarDays, CalendarRange, Check, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import { startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";

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

interface GoalsProgressProps {
  flips: Flip[];
}

export function GoalsProgress({ flips }: GoalsProgressProps) {
  const { data: goals = [], isLoading } = useQuery<ProfitGoal[]>({
    queryKey: ["/api/goals"],
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

  const formatPrice = (price: number) => Math.round(price).toLocaleString();

  const goalTypeConfig = {
    daily: { icon: Calendar, label: "Daily", color: "text-blue-500" },
    weekly: { icon: CalendarDays, label: "Weekly", color: "text-purple-500" },
    monthly: { icon: CalendarRange, label: "Monthly", color: "text-amber-500" },
  } as const;

  if (isLoading) {
    return null;
  }

  if (goals.length === 0) {
    return (
      <Card className="mb-8">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Set profit goals</p>
              <p className="text-sm text-muted-foreground">Track your daily, weekly, and monthly targets</p>
            </div>
          </div>
          <Link href="/goals">
            <Button variant="outline" size="sm" data-testid="button-go-to-goals">
              Set Goals
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Goal Progress
        </CardTitle>
        <Link href="/goals">
          <Button variant="ghost" size="sm" data-testid="button-view-all-goals">
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["daily", "weekly", "monthly"] as const).map((type) => {
            const goal = goals.find((g) => g.goalType === type);
            if (!goal) return null;

            const config = goalTypeConfig[type];
            const currentProfit = profitByPeriod[type];
            const progress = Math.min((currentProfit / goal.targetAmount) * 100, 100);
            const isComplete = currentProfit >= goal.targetAmount;

            return (
              <div key={type} className="space-y-2" data-testid={`goal-progress-${type}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <config.icon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  {isComplete && (
                    <Badge variant="secondary" className="text-xs bg-success/10 text-success border-success/20">
                      <Check className="h-3 w-3 mr-1" />
                      Done
                    </Badge>
                  )}
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className={`font-mono ${currentProfit >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatPrice(currentProfit)}
                  </span>
                  <span className="font-mono">{formatPrice(goal.targetAmount)} gp</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
