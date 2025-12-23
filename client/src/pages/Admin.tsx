import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserCheck, UserX, TrendingUp, DollarSign, Activity, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isOnline: boolean;
  lastHeartbeat: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

interface PresenceData {
  totalUsers: number;
  onlineCount: number;
  offlineCount: number;
  onlineUsers: Array<{
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }>;
}

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  buyTransactions: number;
  sellTransactions: number;
  totalVolume: number;
  totalTaxPaid: number;
  uniqueItems: number;
}

function formatGp(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function Admin() {
  const [, setLocation] = useLocation();

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: users, isLoading: loadingUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: adminCheck?.isAdmin === true,
    refetchInterval: 30000,
  });

  const { data: presence, isLoading: loadingPresence } = useQuery<PresenceData>({
    queryKey: ["/api/admin/presence"],
    enabled: adminCheck?.isAdmin === true,
    refetchInterval: 15000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats"],
    enabled: adminCheck?.isAdmin === true,
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Checking admin access...</div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You do not have administrator privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => setLocation("/")}
              className="text-primary hover:underline"
              data-testid="link-back-home"
            >
              Return to Home
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-admin-title">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor users and platform activity</p>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-foreground"
            data-testid="link-back-home"
          >
            Back to App
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {loadingPresence ? "..." : presence?.totalUsers ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Now</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500" data-testid="text-online-count">
                {loadingPresence ? "..." : presence?.onlineCount ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-offline-count">
                {loadingPresence ? "..." : presence?.offlineCount ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-transactions">
                {loadingStats ? "..." : stats?.totalTransactions ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume Traded</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500" data-testid="text-total-volume">
                {loadingStats ? "..." : formatGp(stats?.totalVolume ?? 0)} gp
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.buyTransactions ?? 0} buys, {stats?.sellTransactions ?? 0} sells
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tax Paid</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500" data-testid="text-total-tax">
                {loadingStats ? "..." : formatGp(stats?.totalTaxPaid ?? 0)} gp
              </div>
              <p className="text-xs text-muted-foreground">2% tax (capped at 5M per trade)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Items Traded</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500" data-testid="text-unique-items">
                {loadingStats ? "..." : stats?.uniqueItems ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Online Users
              </CardTitle>
              <CardDescription>Users active in the last minute</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPresence ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : presence?.onlineUsers.length === 0 ? (
                <div className="text-muted-foreground">No users online</div>
              ) : (
                <div className="space-y-3">
                  {presence?.onlineUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3" data-testid={`user-online-${user.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl ?? undefined} />
                        <AvatarFallback>
                          {user.firstName?.[0] ?? user.email?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.firstName ?? user.email ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Online
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Users
              </CardTitle>
              <CardDescription>Complete user directory with status</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {loadingUsers ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : users?.length === 0 ? (
                <div className="text-muted-foreground">No users found</div>
              ) : (
                <div className="space-y-3">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center gap-3" data-testid={`user-row-${user.id}`}>
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profileImageUrl ?? undefined} />
                          <AvatarFallback>
                            {user.firstName?.[0] ?? user.email?.[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                            user.isOnline ? "bg-green-500" : "bg-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.firstName ?? user.email ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.isOnline
                            ? "Online now"
                            : user.lastHeartbeat
                              ? `Last seen ${formatDistanceToNow(new Date(user.lastHeartbeat), { addSuffix: true })}`
                              : "Never seen"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          user.isOnline
                            ? "bg-green-500/10 text-green-500 border-green-500/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {user.isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
