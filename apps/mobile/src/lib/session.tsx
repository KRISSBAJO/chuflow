import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setApiToken, setUnauthorizedHandler } from './api';
import { secureStorage } from './secure-storage';
import type { SessionUser } from './types';

const TOKEN_KEY = 'chuflow.token';
const USER_KEY = 'chuflow.user';

type SessionState = {
  /** False until the stored sign-in has been checked on launch. */
  ready: boolean;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

/** Hooks other modules can run just before the token is thrown away (e.g. unlinking push). */
const beforeSignOut = new Set<() => Promise<void>>();
export function onBeforeSignOut(task: () => Promise<void>) {
  beforeSignOut.add(task);
  return () => {
    beforeSignOut.delete(task);
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const clear = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    await Promise.all([secureStorage.remove(TOKEN_KEY), secureStorage.remove(USER_KEY)]);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.get<SessionUser>('/auth/me');
    setUser(me);
    await secureStorage.set(USER_KEY, JSON.stringify(me));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [token, cached] = await Promise.all([secureStorage.get(TOKEN_KEY), secureStorage.get(USER_KEY)]);
      if (!token) {
        if (active) setReady(true);
        return;
      }
      setApiToken(token);
      // Show the last known profile straight away so the app opens instantly, even offline.
      if (cached && active) {
        try {
          setUser(JSON.parse(cached) as SessionUser);
        } catch {
          // Ignore a corrupt cache; /auth/me below replaces it.
        }
      }
      try {
        await refreshUser();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await clear();
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [clear, refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ accessToken: string; user: SessionUser }>('/auth/mobile/login', {
      email: email.trim().toLowerCase(),
      password,
    });
    setApiToken(result.accessToken);
    await secureStorage.set(TOKEN_KEY, result.accessToken);
    setUser(result.user);
    await secureStorage.set(USER_KEY, JSON.stringify(result.user));
    // The login reply is a short profile; fetch the full one (preferences, branch) in the background.
    void refreshUser().catch(() => undefined);
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    await Promise.allSettled([...beforeSignOut].map((task) => task()));
    await clear();
  }, [clear]);

  const value = useMemo(() => ({ ready, user, signIn, signOut, refreshUser }), [ready, user, signIn, signOut, refreshUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

export function userId(user: SessionUser | null) {
  return user?.id ?? user?._id ?? '';
}

export function userBranchId(user: SessionUser | null) {
  const ref = user?.branchId;
  if (!ref) return '';
  return typeof ref === 'string' ? ref : (ref._id ?? '');
}
