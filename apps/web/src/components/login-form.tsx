"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";

type LoginFormProps = {
  notice?: string | null;
};

function toFriendlyAuthMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Backend API is not reachable yet. Start `npm run dev:api` and try again.";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("fetch failed")) {
    return "Backend API is not reachable yet. Start `npm run dev:api` and try again.";
  }

  return error instanceof Error ? error.message : "Login failed";
}

export function LoginForm({ notice }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);

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

      setMessage("Login successful. Redirecting to dashboard...");
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
    <form
      action={handleSubmit}
      className="surface rounded-[32px] bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.1)]"
    >
      <p className="eyebrow">Secure Login</p>
      <h1 className="heading mt-3 text-4xl font-semibold text-slate-950">Welcome back</h1>
      <p className="mt-3 text-slate-600">
        Sign in with the seeded super-admin account or your provisioned user.
      </p>
      {notice ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </div>
      ) : null}
      <div className="mt-7 space-y-4">
        <input
          name="email"
          type="email"
          placeholder="admin@church.local"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="ChangeMe123!"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
      
      <p className="mt-4 text-sm text-slate-500">
        Forgot it?{" "}
        <Link href="/forgot-password" className="font-semibold text-slate-900">
          Reset your password
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Need a new church workspace?{" "}
        <Link href="/request-workspace" className="font-semibold text-slate-900">
          Request setup
        </Link>
      </p>
      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
