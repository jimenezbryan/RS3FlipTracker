import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, BarChart3 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">RS3 Flip Tracker</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Log In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">
            Track Your Grand Exchange Flips
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Log your buy/sell transactions, calculate profits with 2% GE tax included, 
            and analyze your trading performance with real-time RS3 price data.
          </p>

          <div className="grid gap-6 sm:grid-cols-3 mb-12">
            <div className="rounded-lg border bg-card p-6">
              <DollarSign className="h-10 w-10 text-success mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Profit Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Automatically calculate profits with 2% GE tax (capped at 5M) included
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <TrendingUp className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Live Prices</h3>
              <p className="text-sm text-muted-foreground">
                Real-time GE prices and 90-day trend analysis from WeirdGloop API
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <BarChart3 className="h-10 w-10 text-accent mx-auto mb-3" />
              <h3 className="font-semibold mb-2">ROI Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Track your return on investment and identify your best flips
              </p>
            </div>
          </div>

          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">Get Started</a>
          </Button>
        </div>
      </main>

      <footer className="border-t bg-card py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          RS3 Flip Tracker - Track your Grand Exchange profits
        </div>
      </footer>
    </div>
  );
}
