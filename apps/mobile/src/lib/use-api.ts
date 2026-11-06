import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';

type State<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
};

/**
 * Loads `path` and reloads it whenever the screen comes back into focus, so counts stay fresh
 * after acting on another screen. Pass `null` to skip loading.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: !!path, refreshing: false });
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const target = latest.current;
    if (!target) return;
    setState((current) => ({
      ...current,
      loading: mode === 'initial' && current.data === undefined,
      refreshing: mode === 'refresh',
    }));
    try {
      const data = await api.get<T>(target);
      if (latest.current === target) setState({ data, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (latest.current === target) {
        setState((current) => ({ ...current, error: errorMessage(error), loading: false, refreshing: false }));
      }
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [path, load]);

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // Skip the first focus: the effect above already loaded it.
      if (focused.current) void load('silent');
      focused.current = true;
    }, [load]),
  );

  return {
    ...state,
    refresh: useCallback(() => load('refresh'), [load]),
    reload: useCallback(() => load('silent'), [load]),
    setData: useCallback((updater: (current: T | undefined) => T | undefined) => {
      setState((current) => ({ ...current, data: updater(current.data) }));
    }, []),
  };
}
