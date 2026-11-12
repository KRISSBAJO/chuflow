import { NextRequest, NextResponse } from "next/server";
import { safeReturnTo } from "./lib/return-to";

import { ACTIVE_WORKSPACE_COOKIE, workspaceApiContext, workspaceId } from "./lib/workspace-routing";
const authPages = ["/login", "/forgot-password", "/reset-password"];
const ministryPages = new Set(["/winners-chapel/nashville/kids", "/winners-chapel/nashville/youth"]);
// `/ops` is the operator console: it keeps its own session and guards itself.
const publicPages = ["/", "/service-unavailable", "/request-workspace", "/workspaces", "/open-in-browser", "/connect", "/intake", "/outreach", "/care-check-in", "/offline", "/children-kiosk", "/children-register", "/youth-register", "/ops"];

function matchesRoute(pathname: string, route: string) {
  if (route === "/") {
    return pathname === "/";
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const active = workspaceApiContext(request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  const token = request.cookies.get(active.cookieName)?.value;
  const isAuthPage = authPages.some((route) => matchesRoute(pathname, route));
  const isPublicPage = publicPages.some((route) =>
    matchesRoute(pathname, route),
  );

  if (!token && !isAuthPage && !isPublicPage && !ministryPages.has(pathname) && pathname !== "/delete-account") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    const workspace = workspaceId(request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value);
    if (workspace) url.searchParams.set("workspace", workspace);
    return NextResponse.redirect(url);
  }

  // `reason` means the app sent the user here on purpose (e.g. a stale cookie), so let them sign in.
  if (token && isAuthPage && pathname === "/login" &&
      !request.nextUrl.searchParams.has("reason") && !request.nextUrl.searchParams.has("workspace")) {
    return NextResponse.redirect(new URL(safeReturnTo(request.nextUrl.searchParams.get("returnTo")), request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-chuflow-return-to", `${pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api).*)"],
};
