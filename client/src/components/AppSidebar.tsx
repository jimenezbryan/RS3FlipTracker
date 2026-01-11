import { Home, BarChart3, Briefcase, Target, Sparkles, TrendingUp, Bell, BookOpen, Shield, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GPStackLogo } from "./GPStackLogo";

const navItems = [
  { href: "/", label: "Flips", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/suggestions", label: "AI Tips", icon: Sparkles },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();
  
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: onlineData } = useQuery<{ onlineCount: number }>({
    queryKey: ["/api/presence/online-count"],
    refetchInterval: 30000,
  });

  const allNavItems = adminCheck?.isAdmin 
    ? [...navItems, { href: "/admin", label: "Admin", icon: Shield }]
    : navItems;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <GPStackLogo size={32} />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">FlipSync</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allNavItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Link href={item.href} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-2">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="online-users-indicator">
          <Users className="h-4 w-4 text-green-500" />
          <span className="font-mono">{onlineData?.onlineCount ?? 0}</span>
          <span className="group-data-[collapsible=icon]:hidden">online</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
