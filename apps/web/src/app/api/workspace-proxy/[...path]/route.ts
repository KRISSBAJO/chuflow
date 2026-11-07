import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_WORKSPACE_COOKIE, DIRECTORY_COOKIE, PRIMARY_API_URL, SHARED_WEB_ORIGIN, SHARED_WORKSPACES, WORKSPACE_TAB_HINT, workspaceApiContext, workspaceId,
} from "@/lib/workspace-routing";

export const runtime = "nodejs";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!SHARED_WORKSPACES) return new Response(null, { status: 404 });
  if (request.method !== "GET" && (!SHARED_WEB_ORIGIN || request.headers.get("origin") !== SHARED_WEB_ORIGIN)) {
    return new Response(null, { status: 403 });
  }

  const { path } = await context.params;
  if (!path.length || path.some((part) => !part || part === "." || part === ".." || /[/%\\]/.test(part))) {
    return new Response(null, { status: 404 });
  }
  const expected = path[0] === "directory" ? null : path[0] === "w" ? workspaceId(path[1]) : undefined;
  if (expected === undefined || (path[0] === "w" && !expected)) return new Response(null, { status: 404 });
  const endpoint = "/" + path.slice(path[0] === "w" ? 2 : 1).map(encodeURIComponent).join("/");
  if (endpoint === "/") return new Response(null, { status: 404 });
  const active = workspaceId(request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  // The shared sign-in directory always lives at the primary API.
  const directory = /^\/auth\/(?:login|forgot-password|reset-password|workspaces)(?:\/|$)/.test(endpoint) || endpoint.includes("/public/")
    || (endpoint === "/workspace-requests" && request.method === "POST");
  if (!directory && expected !== active) {
    const t = await getTranslations("auth.workspacePicker");
    return Response.json({ message: t("scopeChanged") }, { status: 409 });
  }
  const { base, cookieName } = workspaceApiContext(directory ? null : active);
  const token = request.cookies.get(cookieName)?.value;
  const upstreamHeaders = new Headers();
  for (const name of ["accept", "content-type"]) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }
  if (token) upstreamHeaders.set("Cookie", `${cookieName}=${token}`);

  try {
    const upstream = await fetch(base + endpoint + request.nextUrl.search, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const response = new NextResponse(upstream.body, { status: upstream.status });
    for (const name of ["content-type", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    response.headers.set("Cache-Control", "no-store");
    if (upstream.ok && (endpoint === "/auth/login" || endpoint === "/auth/logout")) {
      response.headers.append("Set-Cookie", `${ACTIVE_WORKSPACE_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
      response.headers.append("Set-Cookie", `${WORKSPACE_TAB_HINT}=; Max-Age=0; Path=/`);
    }
    if (upstream.ok && endpoint === "/auth/logout" && cookieName !== DIRECTORY_COOKIE) {
      const directoryToken = request.cookies.get(DIRECTORY_COOKIE)?.value;
      if (directoryToken) {
        try {
          const logout = await fetch(PRIMARY_API_URL + "/auth/logout", {
            method: "POST",
            headers: { Cookie: `${DIRECTORY_COOKIE}=${directoryToken}` },
            signal: AbortSignal.timeout(3000),
          });
          for (const cookie of logout.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
        } catch {
          // Local cookies still need to be cleared if the directory is unavailable.
        } finally {
          response.headers.append("Set-Cookie", `${DIRECTORY_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
        }
      }
    }
    return response;
  } catch {
    const t = await getTranslations("auth");
    return Response.json({ message: t("apiUnavailable") }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
