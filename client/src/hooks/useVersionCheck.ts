import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  getStoredVersion, 
  setStoredVersion, 
  clearStoredVersion 
} from "@/lib/appVersion";

export function useVersionCheck() {
  const { toast } = useToast();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { credentials: 'include' });
        if (!res.ok) return;
        
        const data = await res.json();
        const serverVersion = data.version;
        const storedVersion = getStoredVersion();
        
        if (!storedVersion) {
          setStoredVersion(serverVersion);
          return;
        }

        if (storedVersion !== serverVersion) {
          console.log("[VersionCheck] Version mismatch. Stored:", storedVersion, "Server:", serverVersion);
          
          clearStoredVersion();
          
          toast({
            title: "App Updated",
            description: "A new version is available. Refreshing your session...",
            duration: 3000,
          });

          setTimeout(async () => {
            try {
              await fetch('/api/logout', { 
                method: 'POST', 
                credentials: 'include' 
              });
            } catch {
              // Ignore errors
            }
            
            window.location.href = '/';
          }, 1500);
        }
      } catch (error) {
        console.error("[VersionCheck] Failed to check version:", error);
      }
    };

    setTimeout(checkVersion, 1000);
  }, [toast]);
}
