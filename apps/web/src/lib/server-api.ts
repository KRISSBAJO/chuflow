import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverRead, unavailableHref } from "./server-read";

const AUTH_COOKIE_NAME = "cms_access_token";

export class ServerApiError extends Error {
  constructor(public readonly status: number) {
    super(`The request could not be completed (${status}).`);
    this.name = "ServerApiError";
  }
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const headers: Record<string, string> = {};

  if (token) {
    headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
  }

  return headers;
}

export async function serverGet<T>(path: string, options: { redirectOnForbidden?: boolean } = {}): Promise<T> {
  const headers = await getAuthHeaders();
  let response: Response;

  try {
    response = await serverRead(path, headers);
  } catch {
    redirect(await unavailableHref());
  }

  if (response.status === 401) redirect("/login?reason=session-expired");
  if (response.status === 403 && options.redirectOnForbidden !== false) redirect("/unauthorized");
  if (!response.ok) {
    throw new ServerApiError(response.status);
  }

  return response.json() as Promise<T>;
}

export async function publicServerGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await serverRead(path);
  } catch {
    redirect(await unavailableHref());
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
