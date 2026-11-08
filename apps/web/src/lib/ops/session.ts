import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PRIMARY_API_URL } from "../workspace-routing";
import type { Operator } from "./types";

/*
 * Operator sessions for the site-admin console. The API issues a Bearer token with its own
 * secret; the browser never sees it. The Next.js server keeps it in an HttpOnly cookie and
 * forwards it to `/platform/*`, which always lives at the primary API (never a workspace worker).
 */

export const OPERATOR_COOKIE = "cms_operator_token";
export const PLATFORM_API_URL = PRIMARY_API_URL.replace(/\/$/, "") + "/platform";

export class OpsServerError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "OpsServerError";
  }
}

export async function operatorToken() {
  return (await cookies()).get(OPERATOR_COOKIE)?.value ?? null;
}

export function platformFetch(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(PLATFORM_API_URL + path, {
    ...init,
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
}

/**
 * The signed-in operator, `null` without a valid session and `"disabled"` when the API has no
 * control plane switched on (its `/platform/*` routes answer 404).
 */
export async function getOperator(): Promise<Operator | null | "disabled"> {
  const token = await operatorToken();
  if (!token) return null;
  let response: Response;
  try {
    response = await platformFetch("/auth/me", token);
  } catch {
    throw new OpsServerError(503, "The ChuFlow API is not reachable right now.");
  }
  if (response.status === 404) return "disabled";
  if (response.status === 401) return null;
  if (!response.ok) throw new OpsServerError(response.status, "The operator session could not be checked.");
  return (await response.json()) as Operator;
}

export async function requireOperator(): Promise<Operator> {
  const operator = await getOperator();
  if (operator === "disabled") redirect("/ops/login?reason=disabled");
  if (!operator) redirect("/ops/login?reason=session");
  return operator;
}

/** Server-side read against the control plane; 401 sends the operator back to sign in. */
export async function opsGet<T>(path: string): Promise<T> {
  const token = await operatorToken();
  let response: Response;
  try {
    response = await platformFetch(path, token);
  } catch {
    throw new OpsServerError(503, "The ChuFlow API is not reachable right now.");
  }
  if (response.status === 401) redirect("/ops/login?reason=session");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[]; code?: string };
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new OpsServerError(response.status, message || `The request failed (${response.status}).`, body.code);
  }
  return (await response.json()) as T;
}

/** Like `opsGet`, but a 404 resolves to `null` instead of throwing. */
export async function opsGetOptional<T>(path: string): Promise<T | null> {
  try {
    return await opsGet<T>(path);
  } catch (error) {
    if (error instanceof OpsServerError && error.status === 404) return null;
    throw error;
  }
}
