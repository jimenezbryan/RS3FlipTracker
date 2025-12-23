import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";

export function useHeartbeat(intervalMs: number = 30000) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const sendHeartbeat = async () => {
      try {
        await apiRequest("POST", "/api/heartbeat");
      } catch (error) {
        console.log("Heartbeat failed:", error);
      }
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, intervalMs);

    return () => clearInterval(interval);
  }, [isAuthenticated, intervalMs]);
}
