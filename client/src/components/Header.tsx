import { TrendingUp } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">RS3 Flip Tracker</h1>
            <p className="text-xs text-muted-foreground">Grand Exchange Profit Tracker</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
