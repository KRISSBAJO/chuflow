import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { api, ApiError, NetworkError } from './api';

/*
 * Attendance counted with no signal is kept on the phone and sent as soon as it is back online.
 * Each entry carries its own id so the list can be shown and retried safely.
 */

const KEY = 'chuflow.outbox.attendance';

export type QueuedAttendance = {
  id: string;
  createdAt: string;
  label: string;
  body: Record<string, unknown>;
  /** Set when the API refused it (e.g. a validation error); it then needs a person to look. */
  error?: string;
};

type Listener = (items: QueuedAttendance[]) => void;
const listeners = new Set<Listener>();
let flushing = false;

async function read(): Promise<QueuedAttendance[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAttendance[]) : [];
  } catch {
    return [];
  }
}

async function write(items: QueuedAttendance[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((listener) => listener(items));
}

export async function queueAttendance(label: string, body: Record<string, unknown>) {
  const items = await read();
  items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), label, body });
  await write(items);
}

export async function discardQueued(id: string) {
  await write((await read()).filter((item) => item.id !== id));
}

/** Sends everything waiting. Returns how many were sent. */
export async function flushAttendance() {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = await read();
    const remaining: QueuedAttendance[] = [];
    for (const [index, item] of items.entries()) {
      try {
        await api.post('/attendance', item.body);
        sent += 1;
      } catch (error) {
        if (error instanceof NetworkError) {
          // Still offline: keep this one and everything after it for next time.
          remaining.push(...items.slice(index));
          break;
        }
        remaining.push({ ...item, error: error instanceof ApiError ? error.message : 'Could not send' });
      }
    }
    await write(remaining);
  } finally {
    flushing = false;
  }
  return sent;
}

export function useAttendanceOutbox() {
  const [items, setItems] = useState<QueuedAttendance[]>([]);
  useEffect(() => {
    void read().then(setItems);
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return items;
}

/** Retries the outbox whenever the phone reconnects. Mounted once inside the signed-in app. */
export function useOutboxSync(onSent?: (count: number) => void) {
  useEffect(() => {
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online && wasOffline) {
        void flushAttendance().then((count) => count && onSent?.(count));
      }
      wasOffline = !online;
    });
    void flushAttendance().then((count) => count && onSent?.(count));
    return unsubscribe;
  }, [onSent]);
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected && state.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
