import { TrendingUp, LogOut, Eye, Bell, Home, BarChart3, Briefcase, Target, Shield, User, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const { user } = useAuth();
  const [location] = useLocation();

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const navItems = [
    { href: "/", label: "Flips", icon: Home },
    { href: "/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/goals", label: "Goals", icon: Target },
    { href: "/suggestions", label: "AI Tips", icon: Sparkles },
    { href: "/watchlist", label: "Watchlist", icon: Eye },
    { href: "/alerts", label: "Alerts", icon: Bell },
    { href: "/stats", label: "Stats", icon: BarChart3 },
    ...(adminCheck?.isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-semibold text-foreground">RS3 Flip Tracker</h1>
              <p className="text-xs text-muted-foreground">Grand Exchange Profit Tracker</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <Link href="/profile">
              <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="nav-profile">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.profileImageUrl ?? undefined} alt={user.firstName ?? "User"} />
                  <AvatarFallback>
                    {(user.firstName?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.firstName ?? user.email ?? "User"}
                </span>
              </Button>
            </Link>
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
