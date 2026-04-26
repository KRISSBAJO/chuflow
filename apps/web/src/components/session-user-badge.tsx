"use client";

import { formatRoleLabel, getUserScopeLabel } from "@/lib/permissions";
import { useSession } from "./session-context";

export function SessionUserBadge() {
  const { user, expired, ready } = useSession();

  if (expired) {
    return (
      <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
        Session expired
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
        Loading session...
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const scopeLabel = getUserScopeLabel(user);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
        {initials}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
          {formatRoleLabel(user.role)}
        </p>
        {scopeLabel ? <p className="text-[11px] text-slate-400">{scopeLabel}</p> : null}
      </div>
    </div>
  );
}
