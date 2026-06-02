import Image from "next/image";
import Link from "next/link";
import { getServerSessionUser, type SessionUser } from "@/lib/auth";
import {
  canAccessRoute,
  formatRoleLabel,
  getUserScopeLabel,
  isGlobalRole,
} from "@/lib/permissions";
import { publicServerGet } from "@/lib/server-api";

type PublicSettings = {
  organizationName: string;
  organizationTagline: string;
  publicConnectEnabled?: boolean;
};

async function getPublicSettings(): Promise<PublicSettings> {
  try {
    return await publicServerGet<PublicSettings>("/settings/public");
  } catch {
    return {
      organizationName: "ChuFlow",
      organizationTagline: "From Membership to Ministry",
      publicConnectEnabled: true,
    };
  }
}

async function getOptionalSessionUser() {
  try {
    return await getServerSessionUser();
  } catch {
    return null;
  }
}

function getLoggedInHeadline(user: SessionUser) {
  if (isGlobalRole(user.role)) return "Oversee the ministry network with clarity.";
  if (user.role === "national_admin" || user.role === "national_pastor") return "Lead your national area from one workspace.";
  if (user.role === "district_admin" || user.role === "district_pastor") return "Keep district operations aligned and visible.";
  if (user.role === "branch_admin") return "Run branch operations with confidence.";
  if (user.role === "resident_pastor" || user.role === "associate_pastor") return "Stay close to branch health and approvals.";
  if (user.role === "follow_up") return "Move care work forward with the right records in view.";
  if (user.role === "usher") return "Capture service-day activity from one place.";
  return "Continue ministry operations from your workspace.";
}

function getLoggedInDescription(user: SessionUser) {
  const scopeLabel = getUserScopeLabel(user);
  if (scopeLabel) {
    return `${formatRoleLabel(user.role)} access is active for ${scopeLabel.toLowerCase()}. Continue where your team left off.`;
  }
  return `${formatRoleLabel(user.role)} access is active. Continue where your team left off.`;
}

function getHomeActions(user: SessionUser | null) {
  if (!user) {
    return [
      { href: "/login", label: "Sign in to workspace", kind: "primary" as const },
      { href: "/request-workspace", label: "Request a workspace", kind: "secondary" as const },
    ];
  }

  const actions: { href: string; label: string; kind: "primary" | "secondary" }[] = [];

  const preferredPrimary =
    user.role === "follow_up"
      ? { href: "/follow-up", label: "Open care workflow" }
      : user.role === "usher"
        ? { href: "/attendance", label: "Open attendance" }
        : { href: "/dashboard", label: "Open dashboard" };

  if (canAccessRoute(user.role, preferredPrimary.href)) {
    actions.push({ ...preferredPrimary, kind: "primary" });
  }

  const secondaryCandidates = [
    { href: "/approvals", label: "Approvals" },
    { href: "/guests", label: "Guests" },
    { href: "/members", label: "Members" },
    { href: "/attendance", label: "Attendance" },
    { href: "/finance", label: "Finance" },
  ];

  for (const candidate of secondaryCandidates) {
    if (!canAccessRoute(user.role, candidate.href)) continue;
    if (actions.some((a) => a.href === candidate.href)) continue;
    actions.push({ ...candidate, kind: "secondary" });
    if (actions.length >= 5) break;
  }

  return actions;
}

const FEATURES = [
  {
    title: "Guest Registry",
    description: "Capture every first-time visitor with assisted desk forms or QR self-registration. Assign immediate follow-up with full record clarity.",
    icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  },
  {
    title: "Member Records",
    description: "A complete membership registry with profile management, status tracking, and service unit assignment across all branches.",
    icon: "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    title: "Follow-Up Workflow",
    description: "Assign pastoral care tasks, track follow-up stages, and ensure every visitor and member receives timely and intentional attention.",
    icon: "M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z",
  },
  {
    title: "Attendance Tracking",
    description: "Record service attendance across branches and service types. Monitor trends and identify engagement patterns over time.",
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  },
  {
    title: "Finance Oversight",
    description: "Log tithes, offerings, and expenses with full audit trails. Generate reports and maintain financial transparency across your network.",
    icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  },
  {
    title: "Multi-Branch Structure",
    description: "Manage national, district, and branch hierarchies from one oversight panel. Role-scoped access and live alerts at every level.",
    icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  },
];

const HIERARCHY = [
  { level: "Level 1", name: "National", color: "bg-orange-500", dot: "bg-orange-400", ring: "ring-orange-500/20" },
  { level: "Level 2", name: "District", color: "bg-cyan-500", dot: "bg-cyan-400", ring: "ring-cyan-500/20" },
  { level: "Level 3", name: "Branch", color: "bg-emerald-500", dot: "bg-emerald-400", ring: "ring-emerald-500/20" },
];

const PEOPLE_NODES = [
  { label: "Members", dot: "bg-amber-400" },
  { label: "Guests", dot: "bg-rose-400" },
  { label: "Follow-up", dot: "bg-indigo-400" },
];

function NavLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] shadow-[0_2px_8px_rgba(15,23,42,0.18)] ring-1 ${dark ? "bg-white/10 ring-white/15" : "bg-slate-950 ring-black/10"}`}>
        <Image
          src="/Churchflow.png"
          alt="ChuFlow"
          width={26}
          height={26}
          className="h-6 w-6 object-contain brightness-0 invert"
        />
        <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={`heading text-[17px] font-semibold leading-none tracking-[-0.02em] ${dark ? "text-white" : "text-slate-950"}`}>
          Chu<span className="text-amber-500">Flow</span>
        </span>
        <span className={`text-[10px] font-medium leading-none tracking-[0.04em] ${dark ? "text-slate-500" : "text-slate-400"}`}>
          From Membership to Ministry
        </span>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [, user] = await Promise.all([
    getPublicSettings(),
    getOptionalSessionUser(),
  ]);

  const actions = getHomeActions(user);

  // ── Logged-in workspace portal ───────────────────────────────────────────
  if (user) {
    const headline = getLoggedInHeadline(user);
    const description = getLoggedInDescription(user);
    const scopeLabel = getUserScopeLabel(user);

    return (
      <div className="min-h-screen bg-[#f8f7f4]">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.06),0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="h-[2px] bg-gradient-to-r from-amber-300 via-amber-500 to-orange-400" />
          <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
            <NavLogo />
            <Link
              href={actions[0]?.href || "/dashboard"}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] hover:to-orange-500 transition-all"
            >
              Open workspace
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-600">
            Welcome back
          </p>
          <h1 className="heading mb-3 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            {user.firstName}
          </h1>
          <p className="mb-10 max-w-xl text-lg leading-8 text-slate-500">{description}</p>

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Role", value: formatRoleLabel(user.role) },
              { label: "Scope", value: scopeLabel || "Assigned workspace" },
              { label: "Account", value: user.email },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1.5 truncate text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>

          {actions[0] && (
            <Link
              href={actions[0].href}
              className="mb-8 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {actions[0].label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}

          {actions.length > 1 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Quick links
              </p>
              <div className="flex flex-wrap gap-2">
                {actions.slice(1).map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="mt-12 text-sm text-slate-400">
            {headline}
          </p>
        </main>
      </div>
    );
  }

  // ── Marketing landing page (logged out) ──────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-slate-950">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-white/96 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.06),0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="h-[2px] bg-gradient-to-r from-amber-300 via-amber-500 to-orange-400" />
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
          <NavLogo />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
            >
              Sign in
            </Link>
            <Link
              href="/request-workspace"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:from-amber-400 hover:to-orange-500"
            >
              Get workspace
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_60%_-10%,rgba(251,191,36,0.10),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">

            {/* Left: copy */}
            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-amber-700">
                  Ministry Operations Platform
                </span>
              </div>

              <h1 className="heading mb-6 text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-slate-950 lg:text-[4.25rem]">
                From<br />
                Membership<br />
                <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  to Ministry.
                </span>
              </h1>

              <p className="mb-8 text-lg leading-8 text-slate-500">
                The all-in-one operating system for multi-level church organizations. Manage guests, members, attendance, and follow-up from one coordinated workspace.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Sign in to workspace
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/request-workspace"
                  className="inline-flex items-center rounded-2xl border border-slate-200 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Request workspace
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
                {[
                  "Guest capture & follow-up",
                  "Multi-branch oversight",
                  "Role-scoped access",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-500">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4 shrink-0 text-amber-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: UI mockup */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-amber-100/60 via-orange-50/40 to-slate-100/80" />
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
                  </div>
                  <div className="mx-3 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-center text-[10px] text-slate-400">
                    app.chuflow.com/dashboard
                  </div>
                </div>
                {/* App shell */}
                <div className="flex h-[380px]">
                  {/* Sidebar */}
                  <div className="w-40 shrink-0 border-r border-slate-100 bg-white p-3">
                    <div className="mb-4 flex items-center gap-2 px-2 py-1">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950">
                        <span className="text-[9px] font-bold text-white">CF</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-950">ChuFlow</span>
                    </div>
                    {[
                      { label: "Dashboard", active: true },
                      { label: "Guests", active: false },
                      { label: "Members", active: false },
                      { label: "Follow-Up", active: false },
                      { label: "Attendance", active: false },
                      { label: "Finance", active: false },
                      { label: "Branches", active: false },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`mb-0.5 rounded-lg px-3 py-2 text-[10px] font-medium ${
                          item.active ? "bg-slate-950 text-white" : "text-slate-400"
                        }`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                  {/* Main */}
                  <div className="flex-1 overflow-hidden bg-[#f8f7f4] p-4">
                    <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                      Sunday Operations
                    </p>
                    <p className="mb-4 text-sm font-bold text-slate-950">Welcome back</p>

                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {[
                        { v: "1,205", l: "Members", c: "text-slate-950" },
                        { v: "342", l: "Guests today", c: "text-rose-600" },
                        { v: "48", l: "Follow-ups", c: "text-indigo-600" },
                      ].map((s) => (
                        <div key={s.l} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                          <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                          <p className="text-[9px] text-slate-400">{s.l}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Live Alerts
                      </p>
                      <div className="space-y-1.5">
                        {[
                          { dot: "bg-amber-400", text: "2 branch leadership gaps" },
                          { dot: "bg-rose-400", text: "3 follow-ups unassigned" },
                          { dot: "bg-emerald-400", text: "Attendance recorded — 89%" },
                        ].map((a) => (
                          <div key={a.text} className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.dot}`} />
                            <p className="text-[10px] text-slate-600">{a.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Latest Guests
                      </p>
                      {[
                        { name: "Sarah M.", branch: "Main Branch", status: "New" },
                        { name: "James K.", branch: "East Branch", status: "Follow-up" },
                      ].map((g) => (
                        <div key={g.name} className="flex items-center justify-between py-1">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-700">{g.name}</p>
                            <p className="text-[9px] text-slate-400">{g.branch}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                            g.status === "New" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {g.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Feature strip ── */}
      <section className="border-y border-slate-100 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Guest Capture", sub: "First-visit tracking" },
              { label: "Member Registry", sub: "Full profile management" },
              { label: "Follow-Up", sub: "Pastoral care workflow" },
              { label: "Attendance", sub: "Service-day records" },
              { label: "Finance", sub: "Giving & expense logs" },
              { label: "Multi-Branch", sub: "Hierarchical oversight" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 text-center">
                <div className="h-0.5 w-8 rounded-full bg-amber-400" />
                <p className="text-sm font-semibold text-slate-950">{f.label}</p>
                <p className="text-xs text-slate-400">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-600">
            Capabilities
          </p>
          <h2 className="heading text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            Everything a growing church needs to operate well.
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-100 bg-slate-50 p-6 transition-all duration-200 hover:border-amber-200 hover:bg-amber-50/50 hover:shadow-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100 group-hover:ring-amber-200">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-5 w-5 text-slate-600 group-hover:text-amber-600"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-950">{feature.title}</h3>
              <p className="text-sm leading-6 text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Structure section ── */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <div className="grid items-center gap-16 lg:grid-cols-2">

            {/* Left: copy */}
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-400">
                Built for hierarchy
              </p>
              <h2 className="heading mb-5 text-4xl font-semibold tracking-tight lg:text-5xl">
                Designed for churches with structure.
              </h2>
              <p className="mb-8 text-lg leading-8 text-slate-400">
                Whether you oversee a single branch or a national network, ChuFlow gives every level the right view — with role-scoped access, live alerts, and coordinated workflows from top to bottom.
              </p>
              <div className="space-y-3.5">
                {[
                  "National oversight with full network visibility",
                  "District coordination across assigned branches",
                  "Branch-level operations with team controls",
                  "Role-based access for pastors, staff, and ushers",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/30">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        className="h-3 w-3 text-amber-400"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: hierarchy visual */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-xs">
                {HIERARCHY.map((tier, i) => (
                  <div key={tier.name}>
                    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 ${tier.ring} bg-white/10`}>
                        <div className={`h-4 w-4 rounded-full ${tier.dot}`} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          {tier.level}
                        </p>
                        <p className="text-sm font-semibold text-white">{tier.name}</p>
                      </div>
                    </div>
                    {i < HIERARCHY.length - 1 && (
                      <div className="mx-auto my-2 h-6 w-px bg-slate-700" />
                    )}
                  </div>
                ))}

                <div className="mx-auto my-2 h-6 w-px bg-slate-700" />

                <div className="flex justify-center gap-2">
                  {PEOPLE_NODES.map((node) => (
                    <div
                      key={node.label}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <div className={`h-2 w-2 rounded-full ${node.dot}`} />
                      <p className="text-xs font-medium text-slate-300">{node.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-amber-50">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:px-10 lg:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-600">
            Get started
          </p>
          <h2 className="heading mb-5 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            Ready to bring your church operations online?
          </h2>
          <p className="mb-8 text-lg leading-8 text-slate-500">
            Your workspace is one request away. Get your team set up and start coordinating ministry work from day one.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/request-workspace"
              className="rounded-2xl bg-slate-950 px-7 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Request a workspace
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 hover:bg-white/80"
            >
              Sign in to existing workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0c0d10] text-white">

        {/* Top CTA strip */}
        <div className="border-b border-white/[0.07]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center lg:px-10">
            <div>
              <p className="mb-1.5 text-xl font-semibold tracking-tight text-white">
                Ready to streamline your church operations?
              </p>
              <p className="text-sm leading-6 text-slate-400">
                Get your team set up and start coordinating ministry work from day one.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href="/request-workspace"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-all hover:to-orange-500"
              >
                Request workspace
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Main columns */}
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-[2fr_1fr_1fr]">

            {/* Brand */}
            <div>
              <div className="mb-5">
                <NavLogo dark />
              </div>
              <p className="mb-6 max-w-xs text-sm leading-7 text-slate-400">
                The complete ministry operations platform for national, district, and branch-level church organizations.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Guests", "Members", "Follow-Up", "Finance", "Attendance"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Platform
              </p>
              <ul className="space-y-3.5">
                {[
                  { label: "Guest Registry", href: "/guests" },
                  { label: "Members", href: "/members" },
                  { label: "Follow-Up", href: "/follow-up" },
                  { label: "Attendance", href: "/attendance" },
                  { label: "Finance", href: "/finance" },
                  { label: "Branches", href: "/branches" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Access */}
            <div>
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Workspace Access
              </p>
              <ul className="space-y-3.5">
                {[
                  { label: "Sign in", href: "/login" },
                  { label: "Request a workspace", href: "/request-workspace" },
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Approvals", href: "/approvals" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.05] px-6 py-5 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} ChuFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <p className="text-xs text-slate-600">From Membership to Ministry</p>
            </div>
          </div>
        </div>

      </footer>

    </div>
  );
}
