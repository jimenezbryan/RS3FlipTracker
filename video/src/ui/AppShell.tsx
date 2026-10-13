import React from "react";
import { Img, staticFile } from "remotion";
import {
  Home, BookOpen, Briefcase, Target, Bell, BarChart3, CalendarDays, Activity, Search, FlaskConical,
  Radar, TrendingUp, Shield, Users, PanelLeft, Sun, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Same order and labels as client/src/components/AppSidebar.tsx (nav + admin-only items).
const NAV = [
  { href: "/", label: "Flips", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: CalendarDays },
  { href: "/movers", label: "Movers", icon: Activity },
  { href: "/scanner", label: "Scanner", icon: Search },
  { href: "/alchemy", label: "Alchemy", icon: FlaskConical },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/admin", label: "Admin", icon: Shield },
];

export const SIDEBAR_OPEN = 256;
export const SIDEBAR_ICON = 48;
export const HEADER_H = 48;
/** y of a nav item's centre, for aiming the cursor. */
export const navItemY = (href: string) => 56 + 8 + NAV.findIndex((n) => n.href === href) * 36 + 16;

export const AppShell: React.FC<{
  route: string;
  sidebarWidth: number;
  pressed?: string | null; // nav href or "trigger" currently being clicked
  children: React.ReactNode;
}> = ({ route, sidebarWidth, pressed, children }) => {
  const open = (sidebarWidth - SIDEBAR_ICON) / (SIDEBAR_OPEN - SIDEBAR_ICON); // 0 icon-only .. 1 open
  return (
    <div className="dark flex h-full w-full bg-background text-foreground font-sans antialiased">
      <div className="flex h-full shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground" style={{ width: sidebarWidth }}>
        <div className="flex items-center gap-2 p-3" style={{ paddingLeft: 8 + 4 * open }}>
          <Img src={staticFile("logo.jpg")} width={32} height={32} className="shrink-0 rounded-md" style={{ objectFit: "cover" }} />
          <span className="whitespace-nowrap text-sm font-semibold" style={{ opacity: open }}>FlipSync</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map((item) => {
            const active = item.href === route;
            return (
              <div
                key={item.href}
                className={`flex h-8 items-center gap-2 overflow-hidden rounded-md p-2 text-sm ${
                  active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : ""
                }`}
                style={pressed === item.href ? { background: "var(--elevate-2)" } : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" style={{ marginLeft: -2 }} />
                <span className="whitespace-nowrap" style={{ opacity: open }}>{item.label}</span>
              </div>
            );
          })}
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4 shrink-0 text-green-500" />
            <span className="font-mono">7</span>
            <span style={{ opacity: open }}>online</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-50 border-b bg-card">
          <div className="flex h-12 items-center justify-between gap-4 px-4">
            <Button variant="ghost" size="icon" className="h-7 w-7" style={pressed === "trigger" ? { background: "var(--elevate-2)" } : undefined}>
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">B</span>
                <span className="text-sm text-muted-foreground">Bryan</span>
              </Button>
              <Button variant="ghost" size="icon"><Sun className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};
