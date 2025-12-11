import { TrendingUp, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">RS3 Flip Tracker</h1>
            <p className="text-xs text-muted-foreground">Grand Exchange Profit Tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl ?? undefined} alt={user.firstName ?? "User"} />
                <AvatarFallback>
                  {(user.firstName?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.firstName ?? user.email ?? "User"}
              </span>
            </div>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild data-testid="button-logout">
            <a href="/api/logout">
              <LogOut className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
