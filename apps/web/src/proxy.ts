import { NextRequest, NextResponse } from "next/server";
import { safeReturnTo } from "./lib/return-to";

const AUTH_COOKIE_NAME = "cms_access_token";
const authPages = ["/login", "/forgot-password", "/reset-password"];
const publicPages = ["/", "/service-unavailable", "/request-workspace", "/connect", "/intake", "/outreach", "/care-check-in", "/offline", "/children-kiosk", "/children-register"];

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

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthPage = authPages.some((route) => matchesRoute(pathname, route));
  const isPublicPage = publicPages.some((route) =>
    matchesRoute(pathname, route),
  );

  if (!token && !isAuthPage && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // `reason` means the app sent the user here on purpose (e.g. a stale cookie), so let them sign in.
  if (token && isAuthPage && !request.nextUrl.searchParams.has("reason")) {
    return NextResponse.redirect(new URL(safeReturnTo(request.nextUrl.searchParams.get("returnTo")), request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-chuflow-return-to", `${pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api).*)"],
};
