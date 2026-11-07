import { translate } from '@/i18n/provider';
import { API_URL, WEB_URL } from './config';

/*
 * Tiny API client. The session sets the bearer token once signed in, and registers a handler
 * that signs the user out when the API says the token is no longer valid.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Thrown when the phone can't reach the API at all (no signal, server down). */
export class NetworkError extends Error {
  constructor() {
    super(translate('common.state.networkError'));
  }
}

export type ApiSession = { token: string | null; apiUrl: string; webUrl: string; storageScope: string };
const defaultSession: ApiSession = { token: null, apiUrl: API_URL, webUrl: WEB_URL, storageScope: '' };
let activeSession = defaultSession;
let onUnauthorized: (() => void) | null = null;

export function setApiSession(session?: ApiSession) {
  activeSession = session ?? defaultSession;
}

export function getApiSession() {
  return activeSession;
}

export function getWorkspaceWebUrl() {
  return activeSession.webUrl;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  session = activeSession,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${session.apiUrl}${path}`, {
      credentials: 'omit',
      signal,
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    if (response.status === 401 && session.token && session === activeSession) onUnauthorized?.();
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join(', ') : message || `Request failed (${response.status})`,
      response.status,
    );
  }

  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export function errorMessage(error: unknown, fallback?: string) {
  return error instanceof Error && error.message ? error.message : (fallback ?? translate('common.state.somethingWrong'));
}

export function query(params: Record<string, string | number | undefined | null | false>) {
  const search = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return search ? `?${search}` : '';
}
