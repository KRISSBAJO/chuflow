"use client";

/*
 * Browser calls to the control plane go through `/api/ops/proxy`, which attaches the operator's
 * HttpOnly token. Errors keep the API's `code` so forms can react to specific refusals.
 */

export class OpsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "OpsApiError";
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { message: text };
    }
  }
  if (!response.ok) {
    const raw = body.message;
    const message = Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : "";
    const details: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!["message", "code", "statusCode", "error"].includes(key)) details[key] = value;
    }
    throw new OpsApiError(
      response.status,
      message || friendlyStatus(response.status),
      typeof body.code === "string" ? body.code : undefined,
      details,
    );
  }
  return body as T;
}

function friendlyStatus(status: number) {
  if (status === 401) return "Your operator session has expired. Sign in again.";
  if (status === 403) return "Your operator role cannot do this.";
  if (status === 404) return "Not found.";
  if (status === 409) return "This conflicts with the current state.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status >= 500) return "The ChuFlow API is temporarily unavailable.";
  return `The request failed (${status}).`;
}

export function errorMessage(error: unknown) {
  if (error instanceof OpsApiError) return error.message;
  if (error instanceof TypeError) return "The console could not reach the server. Check your connection.";
  return error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.";
}

export function opsRequest<T>(method: "GET" | "POST" | "PUT" | "PATCH", path: string, body?: unknown) {
  return fetch(`/api/ops/proxy${path}`, {
    method,
    headers:
      body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  }).then((response) => parse<T>(response));
}

export async function operatorLogin(email: string, password: string) {
  const response = await fetch("/api/ops/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    credentials: "same-origin",
  });
  return parse<{ operator: { email: string; role: string } }>(response);
}

export async function operatorLogout() {
  await fetch("/api/ops/session", { method: "DELETE", cache: "no-store", credentials: "same-origin" });
}
