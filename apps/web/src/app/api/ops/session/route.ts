import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE, platformFetch } from "@/lib/ops/session";
import { SHARED_WEB_ORIGIN } from "@/lib/workspace-routing";

export const runtime = "nodejs";

const SESSION_SECONDS = 8 * 3600;

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === (SHARED_WEB_ORIGIN || request.nextUrl.origin);
}

/** Signs an operator in: the API's Bearer token is kept in an HttpOnly cookie, never returned. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return Response.json({ message: "Enter your email and password." }, { status: 400 });
  }
  if (typeof credentials.email !== "string" || typeof credentials.password !== "string") {
    return Response.json({ message: "Enter your email and password." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await platformFetch("/auth/login", null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email.trim().toLowerCase(), password: credentials.password }),
    });
  } catch {
    return Response.json({ message: "The ChuFlow API is not reachable right now." }, { status: 502 });
  }

  if (upstream.status === 404) {
    return Response.json(
      { code: "platform_disabled", message: "The control plane is not enabled on this API." },
      { status: 404 },
    );
  }
  if (!upstream.ok) {
    const message =
      upstream.status === 401
        ? "Incorrect email or password."
        : upstream.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "Sign-in failed. Please try again.";
    return Response.json({ message }, { status: upstream.status });
  }

  const session = (await upstream.json()) as {
    accessToken: string;
    expiresIn?: number;
    operator: { email: string; role: string };
  };
  const response = NextResponse.json({ operator: session.operator }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(OPERATOR_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: (SHARED_WEB_ORIGIN || request.nextUrl.origin).startsWith("https:"),
    path: "/",
    maxAge: session.expiresIn ?? SESSION_SECONDS,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(OPERATOR_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
