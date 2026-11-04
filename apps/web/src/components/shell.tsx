"use client";

import { ReactNode, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { syncPush } from "@/lib/pwa";
import type { AlertsSummary, SettingsOverview } from "@/lib/types";
import { AppFrame } from "./app/app-frame";
import { SessionGuard } from "./session-guard";
import { SessionProvider, useSession } from "./session-context";

const SIDEBAR_STORAGE_KEY = "chuflow.sidebar.open";
const LEGACY_SIDEBAR_STORAGE_KEY = "churchflow.sidebar.open";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellContent>{children}</ShellContent>
    </SessionProvider>
  );
}

function ShellContent({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [expanded, setExpanded] = useState(true);
  const [branding, setBranding] = useState({
    organizationName: "ChuFlow",
    organizationTagline: "From Membership to Ministry",
  });
  const [headerStats, setHeaderStats] = useState({
    firstTimers: 0,
    pendingFollowUp: 0,
    pendingApprovals: 0,
    activeAlerts: 0,
  });
  const [alertItems, setAlertItems] = useState<AlertsSummary["items"]>([]);
  const [branchCount, setBranchCount] = useState(0);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY);
    if (stored === "false") {
      queueMicrotask(() => setExpanded(false));
    }
  }, []);

  function handleExpandedChange(next: boolean) {
    setExpanded(next);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
  }

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch(`${API_URL}/settings/overview`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const overview = (await response.json()) as SettingsOverview;

        if (!active) {
          return;
        }

        setBranding({
          organizationName: overview.app.organizationName || "ChuFlow",
          organizationTagline:
            overview.app.organizationTagline || "From Membership to Ministry",
        });
      } catch {
        // Leave the fallback brand copy in place if settings cannot be loaded.
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  // Re-link this device's notifications to whoever is signed in (also renews dropped subscriptions).
  const signedInAs = user?.id ?? user?._id ?? user?.email;
  useEffect(() => {
    if (signedInAs) {
      void syncPush();
    }
  }, [signedInAs]);

  useEffect(() => {
    let active = true;

    async function loadHeaderStats() {
      if (!user?.role) {
        return;
      }

      const days = user.preferences?.defaultReportDays ?? 30;

      try {
        const response = await fetch(`${API_URL}/alerts/summary?days=${days}`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const summary = (await response.json()) as AlertsSummary;

        if (!active) {
          return;
        }

        setHeaderStats({
          firstTimers: summary.quickStats.firstTimers,
          pendingFollowUp: summary.quickStats.pendingFollowUp,
          pendingApprovals: summary.quickStats.pendingApprovals,
          activeAlerts: summary.quickStats.activeAlerts,
        });
        setAlertItems(summary.items.slice(0, 6));
        setBranchCount(summary.scope.branchCount);
      } catch {
        // Keep default counts when live operational stats cannot be loaded.
      }
    }

    void loadHeaderStats();

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <SessionGuard>
      <AppFrame
        user={user}
        branding={branding}
        headerStats={headerStats}
        alertItems={alertItems}
        branchCount={branchCount}
        expanded={expanded}
        onExpandedChange={handleExpandedChange}
      >
        {children}
      </AppFrame>
    </SessionGuard>
  );
}
