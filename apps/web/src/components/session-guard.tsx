"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { canAccessRoute } from "@/lib/permissions";
import { Wordmark } from "./brand/wordmark";
import { useSession } from "./session-context";

function SessionLoader() {
  const t = useTranslations("admin.pwa");
  return (
    <div className="lp-root app-loader fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white" role="status" aria-live="polite">
      <Wordmark size={40} href={null} />
      <div className="app-loader-track mt-9 h-[2px] w-40 overflow-hidden rounded-full bg-[#f1f0ec]">
        <span className="app-loader-bar lp-flame-bg block h-full w-1/3 rounded-full" />
      </div>
      <p className="mt-5 text-[14px] text-[#8a8780]">{t("preparingWorkspace")}</p>
    </div>
  );
}

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, expired, user } = useSession();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (expired || !user) {
      window.location.href = "/login?reason=session-expired";
      return;
    }

    if (!canAccessRoute(user.role, pathname)) {
      window.location.href = "/unauthorized";
    }
  }, [expired, pathname, ready, user]);

  if (!ready) {
    return <SessionLoader />;
  }

  if (!user || !canAccessRoute(user.role, pathname)) {
    return null;
  }

  return <>{children}</>;
}
