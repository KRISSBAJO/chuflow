import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, getApiSession, NetworkError, request, setApiSession, setUnauthorizedHandler, type ApiSession } from './api';
import { API_URL, WEB_URL, WORKSPACE_DESTINATIONS } from './config';
import { disablePush } from './notifications';
import { secureStorage } from './secure-storage';
import type { SessionUser } from './types';

const TOKEN_KEY = 'chuflow.token';
const USER_KEY = 'chuflow.user';
const WORKSPACE_SESSION_KEY = 'chuflow.workspace-session';

type WorkspaceChoice = { id: string; name: string; current: boolean };
type WorkspaceLogin = { accessToken: string; user: SessionUser };
type StoredSession = { token: string | null; directoryToken: string; workspaceId: string | null };

function directorySession(token: string | null): ApiSession {
  return { apiUrl: API_URL, webUrl: WEB_URL, token, storageScope: '' };
}

function activeApiSession(session: StoredSession): ApiSession {
  if (!session.workspaceId) return directorySession(session.token);
  const destination = WORKSPACE_DESTINATIONS.find((site) => site.id === session.workspaceId);
  if (!destination) throw new Error('Workspace is unavailable.');
  return { ...destination, token: session.token, storageScope: destination.id };
}

type SessionState = {
  /** False until the stored sign-in has been checked on launch. */
  ready: boolean;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  workspaces: WorkspaceChoice[];
  choosingWorkspace: boolean;
  showWorkspacePicker: () => void;
  closeWorkspacePicker: () => void;
  switchWorkspace: (id: string) => Promise<void>;
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
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[]>([]);
  const [choosingWorkspace, setChoosingWorkspace] = useState(false);
  const stored = useRef<StoredSession | null>(null);

  const clear = useCallback(async () => {
    stored.current = null;
    setApiSession();
    setUser(null);
    setWorkspaces([]);
    setChoosingWorkspace(false);
    await Promise.all([secureStorage.remove(TOKEN_KEY), secureStorage.remove(USER_KEY), secureStorage.remove(WORKSPACE_SESSION_KEY)]);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = getApiSession();
    const me = await api.get<SessionUser>('/auth/me');
    if (getApiSession() !== session) return;
    setUser(me);
    await secureStorage.set(USER_KEY, JSON.stringify(me));
  }, []);

  const loadChoices = useCallback(async (directoryToken: string) => {
    if (!WORKSPACE_DESTINATIONS.length) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const options = await request<WorkspaceChoice[]>('GET', '/auth/workspaces', undefined, directorySession(directoryToken), controller.signal);
      return options.filter((option) => option.current || WORKSPACE_DESTINATIONS.some((site) => site.id === option.id));
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [legacyToken, cached, workspaceSession] = await Promise.all([
          secureStorage.get(TOKEN_KEY), secureStorage.get(USER_KEY), secureStorage.get(WORKSPACE_SESSION_KEY),
        ]);
        const session = workspaceSession ? JSON.parse(workspaceSession) as StoredSession
          : legacyToken ? { token: legacyToken, directoryToken: legacyToken, workspaceId: null } : null;
        if (!active || !session) return;
        stored.current = session;
        setApiSession(activeApiSession(session));
        if (cached) {
          try {
            const profile = JSON.parse(cached) as SessionUser;
            if (!session.workspaceId || profile.workspace?.id === session.workspaceId) setUser(profile);
          } catch {
            // Refresh the profile from the selected workspace.
          }
        }
        void loadChoices(session.directoryToken).then((choices) => {
          if (active && stored.current === session) setWorkspaces(choices);
        }).catch(() => undefined);
        await refreshUser();
      } catch (error) {
        if (!(error instanceof NetworkError) && !(error instanceof ApiError && error.status !== 401)) await clear();
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [clear, loadChoices, refreshUser]);

  const activate = useCallback(async (session: StoredSession, profile: SessionUser) => {
    // Persist the endpoint selection and its token together. Drop the old profile first.
    await secureStorage.remove(USER_KEY);
    await secureStorage.set(WORKSPACE_SESSION_KEY, JSON.stringify(session));
    stored.current = session;
    setApiSession(activeApiSession(session));
    setUser(profile);
    await secureStorage.set(USER_KEY, JSON.stringify(profile));
    void refreshUser().catch(() => undefined);
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await request<WorkspaceLogin>('POST', '/auth/mobile/login', {
      email: email.trim().toLowerCase(), password,
    }, directorySession(null));
    const choices = await loadChoices(result.accessToken).catch(() => []);
    setWorkspaces(choices);
    setChoosingWorkspace(choices.length > 1);
    try {
      await activate({ token: result.accessToken, directoryToken: result.accessToken, workspaceId: null }, result.user);
    } catch (error) {
      setChoosingWorkspace(false);
      throw error;
    }
  }, [activate, loadChoices]);

  const switchWorkspace = useCallback(async (id: string) => {
    const session = stored.current;
    const choice = workspaces.find((item) => item.id === id);
    if (!session || !choice) return;
    const nextId = choice.current ? null : choice.id;
    if (nextId === session.workspaceId) {
      setChoosingWorkspace(false);
      return;
    }

    const source = directorySession(session.directoryToken);
    let result: WorkspaceLogin;
    if (choice.current) {
      result = { accessToken: session.directoryToken, user: await request('GET', '/auth/me', undefined, source) };
    } else {
      const destination = activeApiSession({ ...session, workspaceId: choice.id, token: null });
      const { handoff } = await request<{ handoff: string }>('POST', `/auth/workspaces/${encodeURIComponent(choice.id)}/handoff`, {}, source);
      result = await request('POST', '/auth/workspace/exchange', { handoff }, destination);
    }
    if (result.user.workspace?.id !== choice.id || stored.current !== session) throw new Error('Workspace sign-in failed.');
    await disablePush(true);
    if (stored.current !== session) throw new Error('Workspace sign-in failed.');
    await activate({ token: result.accessToken, directoryToken: session.directoryToken, workspaceId: nextId }, result.user);
    setChoosingWorkspace(false);
  }, [activate, workspaces]);

  const signOut = useCallback(async () => {
    await Promise.allSettled([...beforeSignOut].map((task) => task()));
    await clear();
  }, [clear]);

  const value = useMemo(() => ({
    ready, user, signIn, signOut, refreshUser, workspaces, choosingWorkspace,
    showWorkspacePicker: () => setChoosingWorkspace(true),
    closeWorkspacePicker: () => setChoosingWorkspace(false),
    switchWorkspace,
  }), [ready, user, signIn, signOut, refreshUser, workspaces, choosingWorkspace, switchWorkspace]);
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
