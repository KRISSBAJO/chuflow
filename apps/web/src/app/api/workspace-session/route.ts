import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api";
import { roleHomeHref } from "@/lib/permissions";

export async function POST(request: Request) {
  const directoryOrigin = process.env.NEXT_PUBLIC_CHUFLOW_DIRECTORY_ORIGIN;
  if (!directoryOrigin || request.headers.get("origin") !== directoryOrigin) {
    return new Response(null, { status: 403 });
  }

  const failure = () => NextResponse.redirect(new URL("/login?reason=workspace-sign-in", request.url), 303);

  try {
    const handoff = (await request.formData()).get("handoff");
    if (typeof handoff !== "string" || handoff.length > 4096) return failure();
    const response = await fetch(`${API_URL}/auth/workspace/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoff }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return failure();

    const cookie = response.headers.get("set-cookie");
    if (!cookie) return failure();
    const { user } = (await response.json()) as { user?: { role?: string } };
    const redirect = NextResponse.redirect(new URL(roleHomeHref(user?.role), request.url), 303);
    redirect.headers.set("Set-Cookie", cookie);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  } catch {
    return failure();
  }
}
