"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { filterNavByRole } from "@/lib/permissions";
import type {
  AlertsSummary,
  SettingsOverview,
} from "@/lib/types";
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
  { href: "/finance", label: "Finance" },
  { href: "/branches", label: "Branches" },
  { href: "/structure", label: "Structure" },
  { href: "/users", label: "Users" },
  { href: "/templates", label: "Templates" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    const storedValue =
      window.localStorage.getItem("chuflow.sidebar.open") ??
      window.localStorage.getItem("churchflow.sidebar.open");
    if (storedValue !== null) {
      setIsSidebarOpen(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("chuflow.sidebar.open", String(isSidebarOpen));
  }, [isSidebarOpen]);

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

  return (
    <SessionGuard>
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-white">
        <div
          className={[
            isCompact
              ? "mx-auto grid min-h-screen max-w-[1480px] gap-4 p-3"
              : "mx-auto grid min-h-screen max-w-[1520px] gap-6 p-4",
            isSidebarOpen
              ? isCompact
                ? "lg:grid-cols-[260px_minmax(0,1fr)]"
                : "lg:grid-cols-[280px_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,1fr)]",
          ].join(" ")}
        >
          {/* Sidebar */}
          {isSidebarOpen ? (
            <aside
              className={`surface flex min-w-0 flex-col rounded-3xl border border-white/60 bg-white/95 shadow-xl backdrop-blur-xl ${
                isCompact ? "p-5" : "p-6"
              }`}
            >
            {/* Logo + Brand */}
            <div className="mb-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-black text-xl font-bold text-white shadow-inner">
                CF
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight text-slate-900">
                  {branding.organizationName}
                </p>
                <p className="text-xs text-slate-500">{branding.organizationTagline}</p>
              </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Hide
              </button>
            </div>

            {/* Tagline */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold leading-tight tracking-tighter text-slate-900">
                From membership<br />to ministry.
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
                    className={`group flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                        : "text-slate-600 hover:bg-orange-100 hover:text-orange-800 active:scale-[0.985]"
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
          ) : null}

          {/* Main Content Area */}
          <main className={`min-w-0 flex flex-col ${isCompact ? "gap-4" : "gap-6"}`}>
            {/* Top Bar */}
            <div className={`surface flex min-w-0 flex-col gap-4 rounded-3xl border border-white/60 bg-white/90 shadow backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between ${isCompact ? "p-5" : "p-6"}`}>
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((current) => !current)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {isSidebarOpen ? "Collapse menu" : "Open menu"}
                </button>
                <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.125em] text-amber-600">
                  SUNDAY OPERATIONS
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  Welcome back
                </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex min-w-[250px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm lg:max-w-sm"
                >
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search guests, members, branches, users..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Search
                  </button>
                </form>

                {/* Quick Stats */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 px-5 py-2.5 text-sm font-semibold text-orange-800 shadow-sm">
                    {headerStats.firstTimers} first-timers
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 px-5 py-2.5 text-sm font-semibold text-sky-800 shadow-sm">
                    {headerStats.pendingFollowUp} follow-up pending
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 px-5 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm">
                    {headerStats.pendingApprovals} approvals
                  </div>
                  <Link
                    href="/approvals"
                    className="rounded-2xl bg-gradient-to-br from-rose-100 to-orange-100 px-5 py-2.5 text-sm font-semibold text-rose-800 shadow-sm"
                  >
                    {headerStats.activeAlerts} live alerts
                  </Link>
                </div>

                {/* User Section */}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <SessionUserBadge />
                  <LogoutButton compact />
                </div>
              </div>
            </div>

            {alertItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Live alerts
                </span>
                {alertItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`rounded-2xl px-4 py-2 text-xs font-semibold shadow-sm transition hover:opacity-90 ${
                      item.tone === "critical"
                        ? "bg-rose-100 text-rose-800"
                        : item.tone === "warm"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-sky-100 text-sky-800"
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
            <div className="min-w-0 flex-1 overflow-x-hidden rounded-3xl bg-white/80 p-1 shadow-sm backdrop-blur">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}
