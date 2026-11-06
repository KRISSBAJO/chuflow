import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import type { AlertsSummary } from './types';

type AlertsState = { summary: AlertsSummary | null; refresh: () => Promise<void> };

const AlertsContext = createContext<AlertsState>({ summary: null, refresh: async () => undefined });

const REFRESH_MS = 60_000;

/** Live counts for tab badges, Home and Approvals; refreshed every minute and on app resume. */
export function AlertsProvider({ days = 30, children }: { days?: number; children: ReactNode }) {
  const [summary, setSummary] = useState<AlertsSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await api.get<AlertsSummary>(`/alerts/summary?days=${days}`));
    } catch {
      // Keep the last counts when offline.
    }
  }, [days]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  return <AlertsContext.Provider value={{ summary, refresh }}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  return useContext(AlertsContext);
}
