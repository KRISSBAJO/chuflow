import { translate } from '@/i18n/provider';
import { API_URL, WEB_URL } from './config';
import { isPlanErrorCode, type PlanErrorCode } from './plan-codes';

/*
 * Tiny API client. The session sets the bearer token once signed in, and registers a handler
 * that signs the user out when the API says the token is no longer valid.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: unknown,
    readonly guestId?: string,
  ) {
    super(message);
  }
}

/** A 402: the church's plan, not the person's role, refused the request. */
export class PlanError extends ApiError {
  constructor(
    readonly code: PlanErrorCode,
    readonly details: { feature?: string; quota?: string; limit?: number; current?: number },
  ) {
    super(planErrorMessage(code, details), 402);
  }
}

function planErrorMessage(code: PlanErrorCode, details: { feature?: string; quota?: string; limit?: number; current?: number }) {
  const feature = details.feature ? translate(`common.plan.features.${details.feature}`) : '';
  const quota = details.quota ? translate(`common.plan.quotaUnits.${details.quota}`) : '';
  return translate(`common.plan.errors.${code}`, {
    feature,
    quota,
    limit: details.limit ?? 0,
    current: details.current ?? 0,
  });
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
    const refusal = data as { code?: unknown; guestId?: string; feature?: string; quota?: string; limit?: number; current?: number } | null;
    if (response.status === 402 && isPlanErrorCode(refusal?.code)) {
      throw new PlanError(refusal.code, { feature: refusal.feature, quota: refusal.quota, limit: refusal.limit, current: refusal.current });
    }
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join(', ') : message || `Request failed (${response.status})`,
      response.status,
      refusal?.code,
      refusal?.guestId,
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
