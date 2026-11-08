import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_COOKIE, platformFetch } from "@/lib/ops/session";

export const runtime = "nodejs";

/*
 * Forwards browser requests from the operator console to the control-plane API with the
 * operator's token. Only same-origin requests are forwarded, which with the Lax cookie keeps
 * other sites from driving the console.
 */
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin !== request.nextUrl.origin) return new Response(null, { status: 403 });

  const { path } = await context.params;
  if (!path.length || path.some((part) => !part || part === "." || part === ".." || /[/%\\]/.test(part))) {
    return new Response(null, { status: 404 });
  }
  if (path[0] === "auth") return new Response(null, { status: 404 });

  const token = request.cookies.get(OPERATOR_COOKIE)?.value;
  if (!token) return Response.json({ message: "Sign in to the operator console first." }, { status: 401 });

  const endpoint = "/" + path.map(encodeURIComponent).join("/") + request.nextUrl.search;
  try {
    const upstream = await platformFetch(endpoint, token, {
      method: request.method,
      headers: request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {},
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    });
    const response = new NextResponse(upstream.body, { status: upstream.status });
    const type = upstream.headers.get("content-type");
    if (type) response.headers.set("Content-Type", type);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json({ message: "The ChuFlow API is not reachable right now." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
