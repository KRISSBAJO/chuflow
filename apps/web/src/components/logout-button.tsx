"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import { forgetDeviceOnServer } from "@/lib/pwa";

export function LogoutButton({ compact = false, icon = false }: { compact?: boolean; icon?: boolean }) {
  const t = useTranslations("common");
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      // Stop this device getting the signed-out user's alerts (it may be a shared phone).
      await forgetDeviceOnServer();
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  if (icon) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-label={t("signOut")}
        title={t("signOut")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8a8780] transition-colors hover:bg-white hover:text-[var(--lp-ink)] disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-[18px] w-[18px]" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        compact
          ? "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          : "rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
      }
    >
      {loading ? t("signingOut") : t("signOut")}
    </button>
  );
}
