import { headers } from "next/headers";
import { PRIMARY_API_URL } from "./workspace-routing";
import { safeReturnTo } from "./return-to";

export async function unavailableHref(returnTo?: string) {
  const target = returnTo || (await headers()).get("x-chuflow-return-to");
  return `/service-unavailable?returnTo=${encodeURIComponent(safeReturnTo(target))}`;
}

export async function serverRead(path: string, requestHeaders: Record<string, string> = {}, base = PRIMARY_API_URL) {
  const response = await fetch(`${base}${path}`, {
    headers: requestHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (response.status >= 500 || response.status === 429 || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The church server is temporarily unavailable.");
  }
  return response;
}
