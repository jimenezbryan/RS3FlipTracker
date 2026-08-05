import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
          signal: controller.signal,
        });

        // ponytail: only 401 means "logged out". Everything else — a 500, a cold-start
        // timeout, a dropped connection — means "couldn't tell", and returning null for
        // those logged the user straight back out to the landing page. With retry:false a
        // single hiccup was a logout. Throwing lets react-query retry instead.
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(`/api/auth/user returned ${res.status}`);

        return await res.json();
      } finally {
        window.clearTimeout(timeout);
      }
    },
    retry: 2,
    retryDelay: (attempt) => 500 * 2 ** attempt,
  });

  const refetchUser = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetchUser,
  };
}
