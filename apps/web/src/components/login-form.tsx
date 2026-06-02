"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";

type LoginFormProps = {
  notice?: string | null;
};

function toFriendlyAuthMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "ChuFlow API is temporarily unavailable. Please try again shortly.";
  }
  if (error instanceof Error && error.message.toLowerCase().includes("fetch failed")) {
    return "ChuFlow API is temporarily unavailable. Please try again shortly.";
  }
  return error instanceof Error ? error.message : "Login failed";
}

export function LoginForm({ notice }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Login failed");
      }

      setIsSuccess(true);
      setMessage("Signed in. Redirecting...");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (error) {
      setMessage(toFriendlyAuthMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="heading mb-1 text-3xl font-semibold tracking-tight text-slate-950">
        Welcome back
      </h1>
      <p className="mb-8 text-sm leading-6 text-slate-500">
        Sign in to your ChuFlow workspace to continue.
      </p>

      {notice && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Email address
          </label>
          <input
            name="email"
            type="email"
            placeholder="you@church.org"
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-amber-400 focus:ring-3 focus:ring-amber-400/10"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-amber-400 focus:ring-3 focus:ring-amber-400/10"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:to-orange-500 disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </form>

      {message && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            isSuccess
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-8 border-t border-slate-100 pt-6">
        <p className="text-sm text-slate-500">
          Don&apos;t have a workspace?{" "}
          <Link
            href="/request-workspace"
            className="font-semibold text-slate-900 hover:text-amber-600 transition-colors"
          >
            Request one →
          </Link>
        </p>
      </div>
    </div>
  );
}
