"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LogoutButton } from "@/components/logout-button";
import { AppNudge } from "@/components/pwa/app-nudge";
import type { SessionUser } from "@/lib/auth";
import { canAccessRoute, formatRoleLabel, getUserScopeLabel } from "@/lib/permissions";
import type { AlertsSummary } from "@/lib/types";
import { Icon, type IconName } from "./icons";

type BadgeKey = "approvals" | "followUp" | "firstTimers";

type NavItem = { href: string; label: string; icon: IconName; badge?: BadgeKey };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/approvals", label: "Approvals", icon: "approvals", badge: "approvals" },
      { href: "/communications", label: "Communications", icon: "message" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/evangelism", label: "Evangelism", icon: "share" },
      { href: "/guests", label: "Guests", icon: "guests", badge: "firstTimers" },
      { href: "/follow-up", label: "Follow-up", icon: "care", badge: "followUp" },
      { href: "/members", label: "Members", icon: "members" },
      { href: "/service-units", label: "Service units", icon: "units" },
    ],
  },
  {
    label: "Services",
    items: [
      { href: "/attendance", label: "Attendance", icon: "attendance" },
      { href: "/weekly-reports", label: "Weekly reports", icon: "weekly" },
      { href: "/maag-reports", label: "MAAG reports", icon: "maag" },
    ],
  },
  {
    label: "Stewardship",
    items: [{ href: "/finance", label: "Finance", icon: "finance" }],
  },
  {
    label: "Organization",
    items: [
      { href: "/branches", label: "Branches", icon: "branches" },
      { href: "/structure", label: "Structure", icon: "structure" },
      { href: "/users", label: "Users", icon: "users" },
      { href: "/templates", label: "Templates", icon: "templates" },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/reports", label: "Reports", icon: "reports" }],
  },
];

const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: "settings" };

const QUICK_ACTIONS: { href: string; label: string; hint: string; icon: IconName }[] = [
  { href: "/evangelism/new", label: "Add outreach contact", hint: "Follow up an outreach conversation", icon: "share" },
  { href: "/guests/new", label: "Register a guest", hint: "Capture a first-timer", icon: "guests" },
  { href: "/attendance", label: "Record attendance", hint: "Log a service count", icon: "attendance" },
  { href: "/follow-up/new", label: "Log follow-up", hint: "Assign care to someone", icon: "care" },
  { href: "/members/new", label: "Add a member", hint: "Create a member record", icon: "members" },
];

/** Phone tab bar: the first four of these the user can open, then "More" for the full menu. */
const TAB_CANDIDATES: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/guests", label: "Guests", icon: "guests" },
  { href: "/follow-up", label: "Follow-up", icon: "care", badge: "followUp" },
  { href: "/attendance", label: "Attendance", icon: "attendance" },
  { href: "/approvals", label: "Approvals", icon: "approvals", badge: "approvals" },
  { href: "/members", label: "Members", icon: "members" },
  { href: "/reports", label: "Reports", icon: "reports" },
];

const ALERT_TONES: Record<AlertsSummary["items"][number]["tone"], { dot: string; label: string }> = {
  critical: { dot: "bg-red-500", label: "Urgent" },
  warm: { dot: "bg-amber-500", label: "Needs attention" },
  cool: { dot: "bg-sky-500", label: "For review" },
};

export type AppFrameProps = {
  user: SessionUser | null;
  branding: { organizationName: string; organizationTagline: string };
  headerStats: { firstTimers: number; pendingFollowUp: number; pendingApprovals: number; activeAlerts: number };
  alertItems: AlertsSummary["items"];
  branchCount: number;
  /** Desktop sidebar expanded (true) or folded into an icon rail (false). */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return ref;
}

function initialsOf(user: SessionUser | null) {
  if (!user) return "";
  return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
}

function TabBar({
  user,
  badges,
  pathname,
  menuOpen,
  onMore,
}: {
  user: SessionUser | null;
  badges: Record<BadgeKey, number>;
  pathname: string;
  menuOpen: boolean;
  onMore: () => void;
}) {
  const tabs = TAB_CANDIDATES.filter((item) => canAccessRoute(user?.role, item.href)).slice(0, 4);
  const tabClass = (active: boolean) =>
    `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${active ? "text-[var(--lp-ink)]" : "text-[#8a8780] active:text-[var(--lp-ink)]"}`;
  const anyTabActive = tabs.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href);
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              {active ? <span className="lp-flame-bg absolute top-0 h-[3px] w-8 rounded-b-full" /> : null}
              <span className="relative">
                <Icon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.7} />
                {count > 0 ? (
                  <span className="lp-flame-bg absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMore} aria-expanded={menuOpen} className={tabClass(menuOpen || !anyTabActive)}>
          {!menuOpen && !anyTabActive ? <span className="lp-flame-bg absolute top-0 h-[3px] w-8 rounded-b-full" /> : null}
          <Icon name="menu" className="h-[22px] w-[22px]" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function Sidebar({
  user,
  branding,
  badges,
  compact,
  pathname,
  onNavigate,
  onCollapse,
}: {
  user: SessionUser | null;
  branding: AppFrameProps["branding"];
  badges: Record<BadgeKey, number>;
  compact: boolean;
  pathname: string;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessRoute(user?.role, item.href)),
  })).filter((group) => group.items.length > 0);
  const showSettings = canAccessRoute(user?.role, SETTINGS_ITEM.href);
  const scopeLabel = user ? getUserScopeLabel(user) : null;

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const count = item.badge ? badges[item.badge] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={compact ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={[
          "app-nav-item group relative flex items-center gap-3 rounded-xl text-[14px] font-medium transition-colors",
          compact ? "h-11 justify-center" : "h-10 px-3",
          active ? "bg-[var(--lp-ink)] text-white" : "text-[#55534e] hover:bg-[#f2f1ed] hover:text-[var(--lp-ink)]",
        ].join(" ")}
      >
        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
        {compact ? null : <span className="truncate">{item.label}</span>}
        {count > 0 ? (
          compact ? (
            <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${item.badge === "firstTimers" ? "bg-[#b5b2ab]" : "lp-flame-bg"}`} />
          ) : (
            <span
              title={item.badge === "firstTimers" ? `${count} first-timers in your report range` : undefined}
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${active ? "bg-white/15 text-white" : item.badge === "firstTimers" ? "bg-black/[0.06] text-[#55534e]" : "lp-flame-bg text-white"}`}
            >
              {count > 99 ? "99+" : count}
            </span>
          )
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex min-h-16 shrink-0 items-center py-3 ${compact ? "justify-center" : "justify-between gap-2 px-5"}`}>
        {compact ? (
          <Link href="/" aria-label="Home" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--lp-ink)] text-[17px] font-semibold tracking-[-0.04em] text-white">
            C
          </Link>
        ) : (
          <div className="min-w-0">
            {branding.organizationName === "ChuFlow" ? (
              <Wordmark size={22} href="/" />
            ) : (
              <Link href="/" className="block truncate text-[17px] font-semibold tracking-[-0.02em] text-[var(--lp-ink)]">
                {branding.organizationName}
              </Link>
            )}
            {branding.organizationTagline ? (
              <p className="mt-1 truncate text-[11px] text-[#8a8780]">{branding.organizationTagline}</p>
            ) : null}
          </div>
        )}
        {!compact && onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a8780] transition-colors hover:bg-[#f2f1ed] hover:text-[var(--lp-ink)]"
          >
            <Icon name="sidebar" className="h-[17px] w-[17px]" />
          </button>
        ) : null}
      </div>

      <nav className="app-scroll flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {groups.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            {compact ? (
              <div className="mx-auto mb-2 h-px w-6 bg-black/[0.06]" />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a09a]">{group.label}</p>
            )}
            <div className="space-y-0.5">{group.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-black/[0.06] p-3">
        {showSettings ? renderItem(SETTINGS_ITEM) : null}
        {user ? (
          <div className={`flex items-center gap-3 rounded-2xl bg-[#f6f5f1] ${compact ? "flex-col p-2" : "p-2.5"}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[var(--lp-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              {initialsOf(user)}
            </span>
            {compact ? null : (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--lp-ink)]">
                  {user.firstName} {user.lastName}
                </span>
                <span className="block truncate text-[12px] text-[#8a8780]">
                  {formatRoleLabel(user.role)}
                  {scopeLabel ? ` · ${scopeLabel}` : ""}
                </span>
              </span>
            )}
            <LogoutButton icon />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AppFrame({
  user,
  branding,
  headerStats,
  alertItems,
  branchCount,
  expanded,
  onExpandedChange,
  children,
}: AppFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const createRef = useDismiss(createOpen, () => setCreateOpen(false));
  const alertsRef = useDismiss(alertsOpen, () => setAlertsOpen(false));

  const badges: Record<BadgeKey, number> = {
    approvals: headerStats.pendingApprovals,
    followUp: headerStats.pendingFollowUp,
    firstTimers: headerStats.firstTimers,
  };
  const quickActions = QUICK_ACTIONS.filter((action) => canAccessRoute(user?.role, action.href));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div className="lp-root app-root min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-black/[0.06] bg-white transition-[width] duration-300 ease-out xl:block ${expanded ? "w-[264px]" : "w-[76px]"}`}
      >
        <Sidebar
          user={user}
          branding={branding}
          badges={badges}
          compact={!expanded}
          pathname={pathname}
          onCollapse={() => onExpandedChange(false)}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="app-fade absolute inset-0 bg-black/30 backdrop-blur-[2px]"
          />
          <aside className="app-drawer absolute inset-y-0 left-0 w-[min(300px,86vw)] bg-white shadow-2xl">
            <Sidebar
              user={user}
              branding={branding}
              badges={badges}
              compact={false}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div
        className={`pb-[calc(64px+env(safe-area-inset-bottom))] transition-[padding] duration-300 ease-out md:pb-0 ${expanded ? "xl:pl-[264px]" : "xl:pl-[76px]"}`}
      >
        <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--lp-ink)] hover:bg-black/[0.04] md:flex xl:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            {!expanded ? (
              <button
                type="button"
                onClick={() => onExpandedChange(true)}
                aria-label="Expand sidebar"
                aria-controls="app-sidebar"
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#6b6b6b] hover:bg-black/[0.04] hover:text-[var(--lp-ink)] xl:flex"
              >
                <Icon name="sidebar" />
              </button>
            ) : null}

            <form onSubmit={handleSearch} className="relative min-w-0 max-w-[520px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#8a8780]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people, branches, users..."
                aria-label="Search"
                className="h-10 w-full rounded-xl border border-black/[0.07] bg-white pl-10 pr-14 text-[14px] text-[var(--lp-ink)] outline-none transition placeholder:text-[#a3a09a] focus:border-[var(--lp-ink)] focus:shadow-[0_0_0_4px_rgba(245,158,11,0.16)]"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-black/[0.08] bg-[#f6f5f1] px-1.5 py-0.5 text-[11px] font-medium text-[#8a8780] sm:block">
                Ctrl K
              </kbd>
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {quickActions.length > 0 ? (
                <div ref={createRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCreateOpen((value) => !value)}
                    aria-expanded={createOpen}
                    aria-haspopup="menu"
                    className="lp-pill-dark flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-medium sm:px-4"
                  >
                    <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                    <span className="hidden sm:inline">New</span>
                  </button>
                  {createOpen ? (
                    <div role="menu" className="app-pop absolute right-0 top-12 w-72 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(17,17,17,0.35)]">
                      {quickActions.map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          role="menuitem"
                          onClick={() => setCreateOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f6f5f1]"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[var(--lp-ink)]">
                            <Icon name={action.icon} />
                          </span>
                          <span>
                            <span className="block text-[14px] font-medium text-[var(--lp-ink)]">{action.label}</span>
                            <span className="block text-[12px] text-[#8a8780]">{action.hint}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div ref={alertsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsOpen((value) => !value)}
                  aria-expanded={alertsOpen}
                  aria-label={`Alerts, ${headerStats.activeAlerts} active`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.07] bg-white text-[var(--lp-ink)] transition-colors hover:bg-[#f6f5f1]"
                >
                  <Icon name="bell" />
                  {headerStats.activeAlerts > 0 ? (
                    <span className="lp-flame-bg absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white ring-2 ring-white">
                      {headerStats.activeAlerts > 9 ? "9+" : headerStats.activeAlerts}
                    </span>
                  ) : null}
                </button>
                {alertsOpen ? (
                  <div className="app-pop absolute right-0 top-12 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_60px_-20px_rgba(17,17,17,0.35)]">
                    <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
                      <p className="text-[14px] font-semibold text-[var(--lp-ink)]">Alerts</p>
                      <p className="text-[12px] text-[#8a8780]">
                        {branchCount} branch{branchCount === 1 ? "" : "es"} in scope
                      </p>
                    </div>
                    {alertItems.length ? (
                      <ul className="p-2">
                        {alertItems.map((item) => (
                          <li key={item.key}>
                            <Link
                              href={item.href}
                              onClick={() => setAlertsOpen(false)}
                              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#f6f5f1]"
                            >
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ALERT_TONES[item.tone].dot}`} />
                              <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-medium text-[var(--lp-ink)]">
                                  {item.count} {item.label.toLowerCase()}
                                </span>
                                <span className="block text-[12px] leading-[1.5] text-[#8a8780]">
                                  {ALERT_TONES[item.tone].label} · {item.description}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-8 text-center text-[14px] text-[#8a8780]">You&apos;re all caught up.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-[var(--lp-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] xl:hidden">
                {initialsOf(user)}
              </span>
            </div>
          </div>
        </header>

        <main
          className={`mx-auto flex max-w-[1440px] flex-col px-4 sm:px-6 lg:px-8 ${user?.preferences?.interfaceDensity === "compact" ? "gap-4 py-4 lg:py-5" : "gap-6 py-6 lg:py-8"}`}
        >
          <AppNudge />
          {children}
        </main>
      </div>

      <TabBar user={user} badges={badges} pathname={pathname} menuOpen={mobileOpen} onMore={() => setMobileOpen(true)} />
    </div>
  );
}
