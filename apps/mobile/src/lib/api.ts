import { translate } from '@/i18n/provider';
import { API_URL } from './config';

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

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(next: string | null) {
  token = next;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
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
