"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
export function ChildrenAuthBoundary({
  userId,
  role,
  scopeKey,
  children,
}: {
  userId: string;
  role: string;
  scopeKey: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("children.layout");
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          setLocked(true);
          window.location.replace("/login?reason=session-expired");
          return;
        }
        if (!response.ok) return;
        const user = (await response.json()) as {
          id?: string;
          _id?: string;
          role: string;
          branchId?: string;
          oversightRegion?: string;
          district?: string;
        };
        if (!active) return;
        if (
          (user._id || user.id) !== userId ||
          user.role !== role ||
          [
            user.branchId || "",
            user.oversightRegion || "",
            user.district || "",
          ].join("|") !== scopeKey
        ) {
          setLocked(true);
          window.location.reload();
        }
      } catch {
        /* Keep the last roster visible during an outage; all write actions still require a live server. */
      }
    }
    const timer = setInterval(() => void check(), 60000);
    const focus = () => void check();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [userId, role, scopeKey]);
  return locked ? (
    <p role="status" className="children-panel">
      {t("refreshing")}
    </p>
  ) : (
    <>{children}</>
  );
}
