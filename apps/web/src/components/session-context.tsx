"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";

type SessionContextValue = {
  user: SessionUser | null;
  ready: boolean;
  expired: boolean;
  unavailable: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  ready: false,
  expired: false,
  unavailable: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    async function loadUser() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!mounted) {
          return;
        }

        if (response.status === 401) {
          setExpired(true);
          setReady(true);
          return;
        }

        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
          setUnavailable(true);
          setReady(true);
          return;
        }

        const data = (await response.json()) as SessionUser;
        if (data.role === "resident_pastor") {
          try {
            const context = await fetch(`${API_URL}/hierarchy/context`, { credentials: "include", signal: controller.signal });
            if (context.ok) data.hasOversight = ((await context.json()) as { hasOversight: boolean }).hasOversight;
          } catch { data.hasOversight = false; }
        }
        if (!mounted) return;
        setUser(data);
      } catch {
        if (mounted) setUnavailable(true);
      } finally {
        window.clearTimeout(timeout);
        if (mounted) {
          setReady(true);
        }
      }
    }

    void loadUser();

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Refresh only additive access in the background; a transient network problem must not sign someone out.
  useEffect(()=>{
    if(!ready || !user)return;
    let mounted=true;
    const controller=new AbortController();
    const refresh=async()=>{
      try {
        const response=await fetch(`${API_URL}/auth/me`,{credentials:"include",cache:"no-store",signal:controller.signal});
        if(!mounted)return;
        if(response.status===401){setExpired(true);return;}
        if(!response.ok)return;
        const fresh=await response.json() as SessionUser;
        if(mounted)setUser(previous=>previous ? {...previous,additionalPermissions:fresh.additionalPermissions,additionalPermissionExpiries:fresh.additionalPermissionExpiries,entitlements:fresh.entitlements}:previous);
      } catch { /* Keep the last session; the API still checks every protected request. */ }
    };
    const onFocus=()=>{void refresh();};
    const timer=window.setInterval(onFocus,60000);
    window.addEventListener("focus",onFocus);
    return ()=>{mounted=false;controller.abort();window.clearInterval(timer);window.removeEventListener("focus",onFocus);};
  },[ready,user]);

  return (
    <SessionContext.Provider value={{ user, ready, expired, unavailable }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
