"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { filterNavByRole } from "@/lib/permissions";
import type { AlertsSummary, SettingsOverview } from "@/lib/types";
import { LogoutButton } from "./logout-button";
import { SessionGuard } from "./session-guard";
import { SessionProvider, useSession } from "./session-context";
import { SessionUserBadge } from "./session-user-badge";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/communications", label: "Communications" },
  { href: "/guests", label: "Guests" },
  { href: "/follow-up", label: "Follow-Up" },
  { href: "/members", label: "Members" },
  { href: "/service-units", label: "Service Units" },
  { href: "/attendance", label: "Attendance" },
  { href: "/weekly-reports", label: "Weekly Reports" },
  { href: "/finance", label: "Finance" },
  { href: "/branches", label: "Branches" },
  { href: "/structure", label: "Structure" },
  { href: "/users", label: "Users" },
  { href: "/templates", label: "Templates" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

const DESKTOP_SIDEBAR_QUERY = "(min-width: 1280px)";
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
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const visibleLinks = filterNavByRole(links, user);
  const isCompact = user?.preferences?.interfaceDensity === "compact";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarViewport, setIsDesktopSidebarViewport] =
    useState(false);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] =
    useState(false);
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
  const [alertScope, setAlertScope] = useState({
    branchCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const desktopSidebar = window.matchMedia(DESKTOP_SIDEBAR_QUERY);

    function getStoredSidebarValue() {
      return (
        window.localStorage.getItem(SIDEBAR_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_SIDEBAR_STORAGE_KEY)
      );
    }

    function syncSidebarForViewport(matchesDesktop: boolean) {
      setIsDesktopSidebarViewport(matchesDesktop);
      setIsSidebarOpen(
        matchesDesktop && getStoredSidebarValue() !== "false",
      );
    }

    queueMicrotask(() => {
      syncSidebarForViewport(desktopSidebar.matches);
      setHasLoadedSidebarPreference(true);
    });

    function handleDesktopSidebarChange(event: MediaQueryListEvent) {
      syncSidebarForViewport(event.matches);
    }

    desktopSidebar.addEventListener("change", handleDesktopSidebarChange);

    return () => {
      desktopSidebar.removeEventListener("change", handleDesktopSidebarChange);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference || !isDesktopSidebarViewport) {
      return;
    }

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
  }, [hasLoadedSidebarPreference, isDesktopSidebarViewport, isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches) {
      queueMicrotask(() => setIsSidebarOpen(false));
    }
  }, [pathname]);

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
        setAlertItems(summary.items.slice(0, 3));
        setAlertScope({ branchCount: summary.scope.branchCount });
      } catch {
        // Keep default counts when live operational stats cannot be loaded.
      }
    }

    void loadHeaderStats();

    return () => {
      active = false;
    };
  }, [user]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchQuery.trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  function closeSidebarOnNarrowViewport() {
    if (!window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches) {
      setIsSidebarOpen(false);
    }
  }

  return (
    <SessionGuard>
      <div className="min-h-screen overflow-x-hidden bg-[#f4f6f8]">
        <div
          className={[
            isCompact
              ? "mx-auto grid min-h-screen max-w-[1480px] gap-4 p-3"
              : "mx-auto grid min-h-screen max-w-[1520px] gap-6 p-4",
            isSidebarOpen
              ? isCompact
                ? "xl:grid-cols-[260px_minmax(0,1fr)]"
                : "xl:grid-cols-[280px_minmax(0,1fr)]"
              : "xl:grid-cols-[minmax(0,1fr)]",
          ].join(" ")}
        >
          {/* Sidebar */}
          {isSidebarOpen ? (
            <>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm xl:hidden"
              />
              <aside
                id="app-sidebar"
                className={`surface fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(22rem,calc(100vw-2rem))] min-w-0 flex-col overflow-y-auto rounded-r-2xl border border-slate-200 bg-white shadow-2xl xl:sticky xl:inset-auto xl:top-4 xl:z-auto xl:h-[calc(100vh-2rem)] xl:w-auto xl:rounded-2xl xl:shadow-sm ${
                  isCompact ? "p-5" : "p-6"
                }`}
              >
                {/* Logo + Brand */}
                <div className="mb-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-xl font-bold text-white shadow-inner">
                      CF
                    </div>
                    <div>
                      <p className="text-xl font-semibold tracking-tight text-slate-900">
                        {branding.organizationName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {branding.organizationTagline}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Hide
                  </button>
                </div>

                {/* Tagline */}
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold leading-tight tracking-tighter text-slate-900">
                    From membership
                    <br />
                    to ministry.
                  </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1">
                  {visibleLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeSidebarOnNarrowViewport}
                        className={`group flex items-center gap-3 rounded-lg px-5 py-3.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 active:scale-[0.985]"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Footer note (optional) */}
                <div className="mt-auto pt-8 text-center">
                  <p className="text-[10px] uppercase tracking-[0.5px] text-slate-400">
                    Built for impact
                  </p>
                </div>
              </aside>
            </>
          ) : null}

          {/* Main Content Area */}
          <main className={`min-w-0 flex flex-col ${isCompact ? "gap-3" : "gap-4"}`}>
            {/* Top Bar */}
            <div className={`surface flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white ${isCompact ? "p-2.5" : "p-3"}`}>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((current) => !current)}
                  aria-controls="app-sidebar"
                  aria-expanded={isSidebarOpen}
                  title={isSidebarOpen ? "Collapse menu" : "Open menu"}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <span className="sr-only">{isSidebarOpen ? "Collapse menu" : "Open menu"}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 7h16M4 12h16M4 17h16"} />
                  </svg>
                </button>
              </div>

              <div className="grid min-w-0 flex-1 gap-2 xl:grid-cols-[minmax(260px,420px)_minmax(0,1fr)_auto] xl:items-center">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 shadow-sm transition focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100"
                >
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search guests, members, branches, users..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Search
                  </button>
                </form>

                {/* Quick Stats */}
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 xl:flex-nowrap">
                  <div className="whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800">
                    {headerStats.firstTimers} first-timers
                  </div>
                  <div className="whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">
                    {headerStats.pendingFollowUp} follow-up pending
                  </div>
                  <div className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                    {headerStats.pendingApprovals} approvals
                  </div>
                  <Link
                    href="/approvals"
                    className="whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800"
                  >
                    {headerStats.activeAlerts} live alerts
                  </Link>
                </div>

                {/* User Section */}
                <div className="flex min-w-0 items-center gap-2 xl:border-l xl:border-slate-200 xl:pl-3">
                  <SessionUserBadge compact />
                  <LogoutButton compact />
                </div>
              </div>
            </div>

            {alertItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Live alerts
                </span>
                {alertItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 ${
                      item.tone === "critical"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : item.tone === "warm"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-sky-200 bg-sky-50 text-sky-800"
                    }`}
                  >
                    {item.count} {item.label.toLowerCase()}
                  </Link>
                ))}
                <span className="text-xs text-slate-400">
                  Watching {alertScope.branchCount} branch
                  {alertScope.branchCount === 1 ? "" : "es"} in your current scope
                </span>
              </div>
            ) : null}

            {/* Page Content */}
            <div className="min-w-0 flex-1 overflow-x-hidden rounded-2xl bg-transparent p-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}
