import { getTranslations } from "next-intl/server";
import { NextRequest, NextResponse } from "next/server";
import { proxyTarget } from "@/lib/workspace-proxy";
import {
  ACTIVE_WORKSPACE_COOKIE, DIRECTORY_COOKIE, PRIMARY_API_URL, SHARED_WEB_ORIGIN, VERIFIED_WORKSPACES_COOKIE,
  WORKSPACE_TAB_HINT, verifiedWorkspaceIds, workspaceApiContext, workspaceId,
} from "@/lib/workspace-routing";

export const runtime = "nodejs";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (request.method !== "GET" && (!SHARED_WEB_ORIGIN || request.headers.get("origin") !== SHARED_WEB_ORIGIN)) {
    return new Response(null, { status: 403 });
  }

  const { path } = await context.params;
  const target = proxyTarget(path, request.method, request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  if (target.status !== 200) {
    if (target.status === 409) {
      const t = await getTranslations("auth.workspacePicker");
      return Response.json({ message: t("scopeChanged") }, { status: 409 });
    }
    return new Response(null, { status: 404 });
  }
  const { base, cookieName, endpoint, signInWorkspace } = target;
  const generalLogin = endpoint === "/auth/workspace-login" && request.method === "POST";
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
      signal: AbortSignal.timeout(generalLogin ? 45000 : 20000),
    });
    if (generalLogin && upstream.ok) {
      const result = await upstream.json() as { user?: unknown; activeWorkspace?: string | null; workspaces?: string[] };
      const ids = verifiedWorkspaceIds(result.workspaces?.join(","));
      const active = workspaceId(result.activeWorkspace);
      const sessionCookies = upstream.headers.getSetCookie();
      if (!ids.length || !ids.includes(active ?? "directory") ||
          ids.some((id) => !sessionCookies.some((cookie) =>
            cookie.startsWith(workspaceApiContext(id === "directory" ? null : id).cookieName + "=")))) {
        return new Response(null, { status: 502 });
      }
      const response = NextResponse.json({ ...result, workspaces: ids }, { headers: { "Cache-Control": "no-store" } });
      const attributes = { secure: SHARED_WEB_ORIGIN?.startsWith("https:") ?? false, sameSite: "lax" as const, path: "/", maxAge: 86400 };
      response.cookies.set(VERIFIED_WORKSPACES_COOKIE, ids.join(","), { ...attributes, httpOnly: true });
      if (active) {
        response.cookies.set(ACTIVE_WORKSPACE_COOKIE, active, { ...attributes, httpOnly: true });
        response.cookies.set(WORKSPACE_TAB_HINT, active, attributes);
      } else {
        response.cookies.delete(ACTIVE_WORKSPACE_COOKIE);
        response.cookies.delete(WORKSPACE_TAB_HINT);
      }
      for (const id of verifiedWorkspaceIds(request.cookies.get(VERIFIED_WORKSPACES_COOKIE)?.value)) {
        if (!ids.includes(id)) response.cookies.delete(workspaceApiContext(id === "directory" ? null : id).cookieName);
      }
      if (!ids.includes("directory")) response.cookies.delete(DIRECTORY_COOKIE);
      for (const cookie of sessionCookies) response.headers.append("Set-Cookie", cookie);
      return response;
    }
    const response = new NextResponse(upstream.body, { status: upstream.status });
    for (const name of ["content-type", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) response.headers.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    response.headers.set("Cache-Control", "no-store");
    if (upstream.ok && signInWorkspace) {
      // Signed in at a provisioned workspace: every later request in this tab stays with it.
      const secure = SHARED_WEB_ORIGIN?.startsWith("https:") ? "; Secure" : "";
      response.headers.append("Set-Cookie", `${ACTIVE_WORKSPACE_COOKIE}=${signInWorkspace}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly${secure}`);
      response.headers.append("Set-Cookie", `${WORKSPACE_TAB_HINT}=${signInWorkspace}; Path=/; Max-Age=86400; SameSite=Lax${secure}`);
    } else if (upstream.ok && (endpoint === "/auth/login" || endpoint === "/auth/logout")) {
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
    if (upstream.ok && (endpoint === "/auth/logout" || endpoint === "/auth/login")) {
      const previous = verifiedWorkspaceIds(request.cookies.get(VERIFIED_WORKSPACES_COOKIE)?.value);
      for (const id of previous) {
        const name = workspaceApiContext(id === "directory" ? null : id).cookieName;
        if (name !== cookieName) response.headers.append("Set-Cookie", `${name}=; Max-Age=0; Path=/; HttpOnly`);
      }
      response.headers.append("Set-Cookie", `${VERIFIED_WORKSPACES_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
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
