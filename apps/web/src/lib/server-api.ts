import { workspaceServerContext } from "./workspace-server";
import { redirect } from "next/navigation";
import { serverRead, unavailableHref } from "./server-read";

export class ServerApiError extends Error {
  constructor(public readonly status: number) {
    super(`The request could not be completed (${status}).`);
    this.name = "ServerApiError";
  }
}

export async function serverGet<T>(path: string, options: { redirectOnForbidden?: boolean } = {}): Promise<T> {
  const { base, headers } = await workspaceServerContext();
  let response: Response;

  try {
    response = await serverRead(path, headers, base);
  } catch {
    redirect(await unavailableHref());
  }

  if (response.status === 401) redirect("/login?reason=session-expired");
  if (response.status === 403 && options.redirectOnForbidden !== false) redirect("/unauthorized");
  // The church's plan refused it: explain on the plan page instead of a generic error.
  if (response.status === 402) redirect("/plan?blocked=1");
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
