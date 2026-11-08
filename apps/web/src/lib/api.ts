import { isPlanErrorCode, type PlanErrorCode } from "./entitlements";
import { planErrorMessage } from "./plan-messages";
import { PRIMARY_API_URL, SHARED_WORKSPACES, initialWorkspaceProxyUrl } from "./workspace-routing";

export const API_URL = SHARED_WORKSPACES && typeof window !== "undefined" ? initialWorkspaceProxyUrl() : PRIMARY_API_URL;

/** A 402 from the API: the church's plan, not the person's role, refused the request. */
export class PlanError extends Error {
  constructor(
    message: string,
    public readonly code: PlanErrorCode,
    public readonly details: { feature?: string; quota?: string; limit?: number; current?: number } = {},
  ) {
    super(message);
    this.name = "PlanError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as {
        message?: string | string[];
        code?: unknown;
        feature?: string;
        quota?: string;
        limit?: number;
        current?: number;
      };
      const message = Array.isArray(json.message) ? json.message.join(", ") : json.message;
      if (response.status === 402 && isPlanErrorCode(json.code)) {
        throw new PlanError(planErrorMessage(json.code, json), json.code, {
          feature: json.feature,
          quota: json.quota,
          limit: json.limit,
          current: json.current,
        });
      }
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string) {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
  });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}
