import { LogOut, Users } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { GPStackLogo } from "./GPStackLogo";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  const { user } = useAuth();

  const { data: onlineData } = useQuery<{ onlineCount: number }>({
    queryKey: ["/api/presence/online-count"],
    refetchInterval: 30000,
  });

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex items-center gap-3">
            <GPStackLogo size={32} />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">RS3 Flip Tracker</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="online-users-indicator">
            <Users className="h-4 w-4 text-green-500" />
            <span className="font-mono">{onlineData?.onlineCount ?? 0}</span>
            <span className="hidden sm:inline">online</span>
          </div>
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
