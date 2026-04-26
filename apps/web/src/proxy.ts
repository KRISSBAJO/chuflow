import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "cms_access_token";
const authPages = ["/login", "/forgot-password", "/reset-password"];
const publicPages = ["/", "/request-workspace", "/connect", "/intake"];

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
    return NextResponse.redirect(url);
  }

  if (token && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};
