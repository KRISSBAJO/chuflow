"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export function ChangePasswordForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus("New password and confirmation do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus("Password changed successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <h3 className="text-xl font-semibold text-slate-950">Change password</h3>
      <p className="mt-2 text-sm text-slate-500">
        Update your password without leaving the application.
      </p>
      <div className="mt-5 space-y-3">
        <input
          name="currentPassword"
          type="password"
          placeholder="Current password"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        />
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
        disabled={loading}
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Updating..." : "Update password"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
