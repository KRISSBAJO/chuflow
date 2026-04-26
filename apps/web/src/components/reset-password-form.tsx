"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function verifyToken() {
      if (!token) {
        setStatus("Reset token is missing.");
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/auth/reset-password/verify?token=${encodeURIComponent(token)}`,
        );
        const result = await response.json();

        if (!mounted) {
          return;
        }

        if (!response.ok || result.valid === false) {
          setStatus(result.message || "Reset token is invalid or has expired.");
          setValid(false);
        } else {
          setValid(true);
          setStatus(`Token verified. Expires at ${result.expiresAt}.`);
        }
      } catch {
        if (mounted) {
          setStatus("Unable to verify reset token.");
          setValid(false);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    void verifyToken();

    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus("New password and confirmation do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to reset password");
      }

      setStatus("Password reset successful. You can now sign in.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="surface rounded-[32px] bg-white/95 p-7">
      <p className="eyebrow">Reset Password</p>
      <h1 className="heading mt-3 text-4xl font-semibold text-slate-950">Create a new password</h1>
      <p className="mt-3 text-slate-600">
        Use the reset token from your forgot-password flow to set a new password.
      </p>
      <input
        value={token}
        readOnly
        className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
      />
      <div className="mt-4 space-y-3">
        <input
          name="newPassword"
          type="password"
          placeholder="New password"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading || !token || !valid || checking}
        className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {checking ? "Verifying token..." : loading ? "Resetting..." : "Reset password"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
      <p className="mt-5 text-sm text-slate-500">
        Back to <Link href="/login" className="font-semibold text-slate-900">login</Link>
      </p>
    </form>
  );
}
