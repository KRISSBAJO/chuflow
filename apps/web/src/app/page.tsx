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

type HomeAction = {
  href: string;
  label: string;
  kind: "primary" | "secondary";
};

const FEATURES = [
  {
    title: "Guest capture",
    description:
      "Register first-time visitors from a desk, QR code, or public intake route and keep every next step visible.",
  },
  {
    title: "Care workflow",
    description:
      "Assign follow-up, track care status, and keep pastoral teams aligned around people who need attention.",
  },
  {
    title: "Member records",
    description:
      "Maintain clean member profiles, branch assignments, service units, and history without scattered spreadsheets.",
  },
  {
    title: "Attendance",
    description:
      "Record service movement by branch, service type, adults, children, first timers, and new converts.",
  },
  {
    title: "Finance",
    description:
      "Manage offerings, expenses, ledgers, account routing, locks, and audit-friendly finance approvals.",
  },
  {
    title: "Multi-branch oversight",
    description:
      "Give national, district, branch, and ministry workers the right view with role-scoped access.",
  },
];

const WORKFLOW = [
  "Capture the person or service activity",
  "Route the record to the right team",
  "Track approvals, care, attendance, and reports",
];

const LEVELS = [
  { name: "National", description: "Network-wide reporting and governance" },
  { name: "District", description: "Regional coordination and branch health" },
  { name: "Branch", description: "Daily ministry operations and teams" },
];

const FOOTER_LINKS = [
  { label: "Sign in", href: "/login" },
  { label: "Request workspace", href: "/request-workspace" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Guests", href: "/guests" },
  { label: "Members", href: "/members" },
  { label: "Attendance", href: "/attendance" },
];

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

function getHomeActions(user: SessionUser | null): HomeAction[] {
  if (!user) {
    return [
      { href: "/login", label: "Sign in", kind: "primary" },
      { href: "/request-workspace", label: "Request workspace", kind: "secondary" },
    ];
  }

  const actions: HomeAction[] = [];
  const preferredPrimary =
    user.role === "follow_up"
      ? { href: "/follow-up", label: "Open care workflow" }
      : user.role === "usher"
        ? { href: "/attendance", label: "Open attendance" }
        : { href: "/dashboard", label: "Open dashboard" };

  if (canAccessRoute(user.role, preferredPrimary.href)) {
    actions.push({ ...preferredPrimary, kind: "primary" });
  }

  for (const candidate of [
    { href: "/approvals", label: "Approvals" },
    { href: "/guests", label: "Guests" },
    { href: "/members", label: "Members" },
    { href: "/attendance", label: "Attendance" },
    { href: "/finance", label: "Finance" },
  ]) {
    if (!canAccessRoute(user.role, candidate.href)) continue;
    if (actions.some((action) => action.href === candidate.href)) continue;
    actions.push({ ...candidate, kind: "secondary" });
    if (actions.length >= 5) break;
  }

  return actions;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function NavLogo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ${dark ? "bg-white ring-white/20" : "bg-slate-950 ring-slate-950/10"}`}>
        <Image
          src="/Churchflow.png"
          alt="ChuFlow"
          width={44}
          height={44}
          className="h-full w-full object-cover"
        />
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
      </span>
      <span className="min-w-0">
        <span className={`heading block truncate text-xl font-semibold leading-none ${dark ? "text-white" : "text-slate-950"}`}>
          Chu<span className="text-amber-500">Flow</span>
        </span>
        <span className={`mt-1 block truncate text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
          From Membership to Ministry
        </span>
      </span>
    </Link>
  );
}

function ActionLink({ action }: { action: HomeAction }) {
  const isPrimary = action.kind === "primary";
  return (
    <Link
      href={action.href}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:px-5",
        isPrimary
          ? "bg-slate-950 text-white hover:bg-slate-800"
          : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
      ].join(" ")}
    >
      <span className="truncate">{action.label}</span>
      {isPrimary ? <ArrowIcon /> : null}
    </Link>
  );
}

function SectionHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="mb-3 text-xs font-bold uppercase text-teal-700">{label}</p>
      <h2 className="heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function LoggedInHome({ user, actions }: { user: SessionUser; actions: HomeAction[] }) {
  const scopeLabel = getUserScopeLabel(user);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <NavLogo />
          {actions[0] ? <ActionLink action={actions[0]} /> : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-20">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <p className="mb-3 text-xs font-bold uppercase text-teal-700">Welcome back</p>
          <h1 className="heading text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
            {user.firstName}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {getLoggedInDescription(user)}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Role", value: formatRoleLabel(user.role) },
              { label: "Scope", value: scopeLabel || "Assigned workspace" },
              { label: "Account", value: user.email },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">{item.label}</p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((action) => (
              <ActionLink key={action.href} action={action} />
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-bold uppercase text-teal-300">Workspace status</p>
          <h2 className="heading mt-3 text-2xl font-semibold leading-tight">
            {getLoggedInHeadline(user)}
          </h2>
          <div className="mt-6 space-y-3">
            {WORKFLOW.map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <span className="mt-0.5 text-teal-300">
                  <CheckIcon />
                </span>
                <p className="text-sm leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default async function HomePage() {
  const [settings, user] = await Promise.all([
    getPublicSettings(),
    getOptionalSessionUser(),
  ]);
  const actions = getHomeActions(user);

  if (user) {
    return <LoggedInHome user={user} actions={actions} />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLogo />
          <nav className="hidden items-center gap-7 lg:flex">
            <a href="#platform" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              Platform
            </a>
            <a href="#structure" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              Structure
            </a>
            <a href="#access" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
              Access
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">
              Sign in
            </Link>
            <Link href="/request-workspace" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              <span className="sm:hidden">Request</span>
              <span className="hidden sm:inline">Request workspace</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#fbf8f1] text-slate-950">
          <Image
            src="/Churchflow.png"
            alt="ChuFlow flame brand artwork"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 -z-30 h-full w-full object-cover object-center opacity-[0.18]"
          />
          <Image
            src="/Feat_1.png"
            alt=""
            fill
            sizes="100vw"
            className="absolute inset-y-0 right-0 -z-20 hidden h-full w-full object-cover object-[78%_center] opacity-35 lg:block"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#fbf8f1_0%,rgba(251,248,241,0.96)_44%,rgba(251,248,241,0.78)_68%,rgba(251,248,241,0.48)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-white to-transparent" />

          <div className="mx-auto flex min-h-[clamp(600px,calc(100svh-5rem),760px)] max-w-7xl items-center px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-5 w-fit rounded-full border border-amber-300 bg-white/85 px-4 py-2 text-xs font-bold uppercase text-amber-700 shadow-sm">
                Church operations, organized
              </p>
              <h1 className="heading text-6xl font-semibold leading-none text-slate-950 sm:text-7xl lg:text-8xl">
                Chu<span className="text-amber-500">Flow</span>
              </h1>
              <p className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                From membership to ministry.
              </p>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                A focused workspace for guests, members, follow-up, attendance, finance, and multi-branch oversight.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Sign in
                  <ArrowIcon />
                </Link>
                <Link
                  href="/request-workspace"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-50"
                >
                  Request workspace
                </Link>
              </div>
              <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  ["Guest care", "Capture and assign follow-up"],
                  ["Branch oversight", "See every level clearly"],
                  ["Live reporting", "Track movement as it happens"],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <span className="text-amber-500">
                        <CheckIcon />
                      </span>
                      {title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8">
            {[
              { value: "6", label: "Core operating areas" },
              { value: "4", label: "Role-scoped leadership levels" },
              { value: "1", label: "Shared ministry workspace" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-sm text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeader
            label="Capabilities"
            title="A cleaner way to run church operations."
            description="Each workflow is built around daily ministry work: capture the record, route it clearly, and keep leaders informed."
          />
          <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="structure" className="bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase text-teal-300">Built for structure</p>
              <h2 className="heading text-3xl font-semibold leading-tight sm:text-4xl">
                Clear visibility for every level of the church.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-300">
                Leadership teams can work at national, district, or branch level without exposing more than each role needs.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {LEVELS.map((level) => (
                <div key={level.name} className="rounded-lg border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-bold uppercase text-teal-300">Level</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{level.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{level.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 lg:items-center">
            <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:min-h-[440px]">
              <Image
                src="/Churchflow.png"
                alt="ChuFlow visual identity"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase text-teal-700">Operating rhythm</p>
              <h2 className="heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Keep people, services, money, and decisions moving.
              </h2>
              <div className="mt-8 space-y-4">
                {WORKFLOW.map((item) => (
                  <div key={item} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="mt-1 text-teal-700">
                      <CheckIcon />
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="access" className="bg-teal-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-xs font-bold uppercase text-teal-800">Get started</p>
            <h2 className="heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              {settings.organizationTagline || "Bring your ministry operations online."}
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-700">
              Request a workspace for your church team, or sign in if your account is already active.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/request-workspace" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Request workspace
              </Link>
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-700/20 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <NavLogo dark />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              ChuFlow is the ministry operations platform for guest care, member records, attendance, finance, and multi-branch oversight.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-slate-400 hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} ChuFlow. All rights reserved.</p>
            <p>From Membership to Ministry</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
