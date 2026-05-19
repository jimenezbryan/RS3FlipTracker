import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
          signal: controller.signal,
        });

        if (res.status === 401 || !res.ok) {
          return null;
        }

        return await res.json();
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeout);
      }
    },
    retry: false,
  });

  const refetchUser = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetchUser,
  };
}
