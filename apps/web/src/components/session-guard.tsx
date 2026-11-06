"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { canAccessRoute } from "@/lib/permissions";
import { WorkspaceLoader } from "./brand/workspace-loader";
import { useSession } from "./session-context";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, expired, user, unavailable } = useSession();

  useEffect(() => {
    if (!ready) {
      return;
    }

    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    if (unavailable) {
      window.location.replace(`/service-unavailable?returnTo=${returnTo}`);
      return;
    }
    if (expired || !user) {
      window.location.href = `/login?reason=session-expired&returnTo=${returnTo}`;
      return;
    }

    if (!canAccessRoute(user.role, pathname, user.additionalPermissions)) {
      window.location.href = "/unauthorized";
    }
  }, [expired, unavailable, pathname, ready, user]);

  if (!ready || unavailable) {
    return <WorkspaceLoader />;
  }

  if (!user || !canAccessRoute(user.role, pathname, user.additionalPermissions)) {
    return null;
  }

  return <>{children}</>;
}
