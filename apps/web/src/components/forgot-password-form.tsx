"use client";

import Link from "next/link";
import { useState } from "react";
import { API_URL } from "@/lib/api";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);
    setResetUrl(null);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to start password reset");
      }

      setStatus(
        result.delivery === "email"
          ? "Reset email sent. Check your inbox."
          : result.message,
      );
      setResetUrl(result.resetUrl ?? null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start password reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="surface rounded-[32px] bg-white/95 p-7">
      <p className="eyebrow">Password Recovery</p>
      <h1 className="heading mt-3 text-4xl font-semibold text-slate-950">Forgot password?</h1>
      <p className="mt-3 text-slate-600">
        Enter your email and we’ll generate a reset link for this MVP environment.
      </p>
      <input
        name="email"
        type="email"
        placeholder="admin@church.local"
        className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white"
      >
        {loading ? "Generating..." : "Generate reset link"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
      {resetUrl ? (
        <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-4 text-sm text-orange-900">
          <p className="font-semibold">SMTP preview mode</p>
          <a href={resetUrl} className="mt-2 block font-semibold underline">
            Open reset page
          </a>
        </div>
      ) : null}
      <p className="mt-5 text-sm text-slate-500">
        Remembered your password? <Link href="/login" className="font-semibold text-slate-900">Back to login</Link>
      </p>
    </form>
  );
}
