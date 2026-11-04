import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { LandingPage } from "@/components/landing/landing-page";
import { buttonClass } from "@/components/ui/ui";
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

const WORKFLOW = [
  "Capture the person or service activity",
  "Route the record to the right team",
  "Track approvals, care, attendance, and reports",
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

function NavLogo() {
  return <Wordmark size={24} />;
}

function ActionLink({ action }: { action: HomeAction }) {
  return (
    <Link
      href={action.href}
      className={buttonClass(action.kind === "primary" ? "primary" : "secondary", "md", "h-11 px-5")}
    >
      <span className="truncate">{action.label}</span>
      {action.kind === "primary" ? <ArrowIcon /> : null}
    </Link>
  );
}

function LoggedInHome({ user, actions }: { user: SessionUser; actions: HomeAction[] }) {
  const scopeLabel = getUserScopeLabel(user);

  return (
    <div className="lp-root app-root min-h-screen w-full">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <NavLogo />
          {actions[0] ? <ActionLink action={actions[0]} /> : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-20">
        <section className="app-card app-rise p-7 sm:p-10">
          <p className="lp-label">Welcome back</p>
          <h1 className="lp-heading mt-4 text-[2.5rem] leading-[1.05] sm:text-[3.25rem]">{user.firstName}</h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.65] text-[#6b6b6b]">{getLoggedInDescription(user)}</p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Role", value: formatRoleLabel(user.role) },
              { label: "Scope", value: scopeLabel || "Assigned workspace" },
              { label: "Account", value: user.email },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-[#f6f5f1] px-4 py-3.5">
                <dt className="text-[12px] text-[#8a8780]">{item.label}</dt>
                <dd className="mt-1 break-words text-[14px] font-medium text-[#111111]">{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-2">
            {actions.map((action) => (
              <ActionLink key={action.href} action={action} />
            ))}
          </div>
        </section>

        <aside className="app-card app-rise p-7" style={{ animationDelay: "80ms" }}>
          <p className="lp-label">Your workspace</p>
          <h2 className="lp-heading mt-4 text-[22px] leading-[1.2]">{getLoggedInHeadline(user)}</h2>
          <ul className="mt-6 space-y-3">
            {WORKFLOW.map((item) => (
              <li key={item} className="flex gap-3 text-[14px] leading-[1.6] text-[#55534e]">
                <span className="lp-flame-bg mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white">
                  <CheckIcon />
                </span>
                {item}
              </li>
            ))}
          </ul>
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

  return <LandingPage tagline={settings.organizationTagline || "From membership to ministry"} />;
}
