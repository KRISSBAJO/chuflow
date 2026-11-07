import { NextRequest, NextResponse } from "next/server";
import { roleHomeHref } from "@/lib/permissions";
import { ACTIVE_WORKSPACE_COOKIE, DIRECTORY_COOKIE, PRIMARY_API_URL, SHARED_WEB_ORIGIN, SHARED_WORKSPACES, WORKSPACE_TAB_HINT, workspaceApiContext, workspaceId } from "@/lib/workspace-routing";

export async function POST(request: NextRequest) {
  const sourceOrigin = SHARED_WORKSPACES
    ? SHARED_WEB_ORIGIN
    : process.env.NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN;
  if (!sourceOrigin || request.headers.get("origin") !== sourceOrigin) {
    return new Response(null, { status: 403 });
  }

  const destinationOrigin = SHARED_WORKSPACES ? sourceOrigin : request.url;
  const failure = () => NextResponse.redirect(new URL("/login?reason=workspace-sign-in", destinationOrigin), 303);

  try {
    const form = await request.formData();
    const requested = form.get("workspace");
    if (SHARED_WORKSPACES && requested === "directory") {
      const token = request.cookies.get(DIRECTORY_COOKIE)?.value;
      if (!token) return failure();
      const session = await fetch(PRIMARY_API_URL + "/auth/me", {
        headers: { Cookie: `${DIRECTORY_COOKIE}=${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!session.ok) return failure();
      const user = await session.json() as { role?: string };
      const response = NextResponse.redirect(new URL(roleHomeHref(user.role), destinationOrigin), 303);
      response.cookies.delete(ACTIVE_WORKSPACE_COOKIE);
      response.cookies.delete(WORKSPACE_TAB_HINT);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const selected = workspaceId(typeof requested === "string" ? requested : null);
    if (SHARED_WORKSPACES && !selected) return failure();
    const handoff = form.get("handoff");
    if (typeof handoff !== "string" || !handoff || handoff.length > 4096) return failure();
    const { base, cookieName } = workspaceApiContext(selected);
    const response = await fetch(base + "/auth/workspace/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoff }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return failure();

    const cookie = response.headers.getSetCookie().find((value) => value.startsWith(cookieName + "="));
    if (!cookie) return failure();
    const { user } = (await response.json()) as { user?: { role?: string; workspace?: { id: string } } };
    if (selected && user?.workspace?.id !== selected) return failure();
    const redirect = NextResponse.redirect(new URL(roleHomeHref(user?.role), destinationOrigin), 303);
    if (selected) {
      const attributes = { secure: sourceOrigin.startsWith("https:"), sameSite: "lax" as const, path: "/", maxAge: 86400 };
      redirect.cookies.set(ACTIVE_WORKSPACE_COOKIE, selected, { ...attributes, httpOnly: true });
      redirect.cookies.set(WORKSPACE_TAB_HINT, selected, attributes);
    }
    redirect.headers.append("Set-Cookie", cookie);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  } catch {
    return failure();
  }
}
