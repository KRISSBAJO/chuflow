"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";

type SessionContextValue = {
  user: SessionUser | null;
  ready: boolean;
  expired: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  ready: false,
  expired: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (!mounted) {
          return;
        }

        if (response.status === 401) {
          setExpired(true);
          setReady(true);
          return;
        }

        if (!response.ok) {
          setReady(true);
          return;
        }

        const data = (await response.json()) as SessionUser;
        setUser(data);
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, expired }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
