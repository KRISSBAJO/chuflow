"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { canAccessRoute } from "@/lib/permissions";
import { useSession } from "./session-context";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, expired, user } = useSession();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (expired || !user) {
      window.location.href = "/login";
      return;
    }

    if (!canAccessRoute(user.role, pathname)) {
      window.location.href = "/unauthorized";
    }
  }, [expired, pathname, ready, user]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          Verifying session...
        </div>
      </div>
    );
  }

  if (!user || !canAccessRoute(user.role, pathname)) {
    return null;
  }

  return <>{children}</>;
}
