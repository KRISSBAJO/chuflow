"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        compact
          ? "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          : "rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
      }
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
