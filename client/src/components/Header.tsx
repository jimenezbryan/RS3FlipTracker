import { LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-12 items-center justify-between px-4 gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex items-center gap-3">
          {user && (
            <Link href="/profile">
              <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="nav-profile">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.profileImageUrl ?? undefined} alt={user.firstName ?? "User"} />
                  <AvatarFallback className="text-xs">
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
