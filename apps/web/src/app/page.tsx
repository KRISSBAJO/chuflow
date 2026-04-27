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
  kind?: "primary" | "secondary";
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
  if (isGlobalRole(user.role)) {
    return "Oversee the ministry network with clarity.";
  }

  if (user.role === "national_admin" || user.role === "national_pastor") {
    return "Lead your national area from one workspace.";
  }

  if (user.role === "district_admin" || user.role === "district_pastor") {
    return "Keep district operations aligned and visible.";
  }

  if (user.role === "branch_admin") {
    return "Run branch operations with confidence.";
  }

  if (user.role === "resident_pastor" || user.role === "associate_pastor") {
    return "Stay close to branch health and approvals.";
  }

  if (user.role === "follow_up") {
    return "Move care work forward with the right records in view.";
  }

  if (user.role === "usher") {
    return "Capture service-day activity from one place.";
  }

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
      { href: "/login", label: "Sign in to your workspace", kind: "primary" },
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

  const secondaryCandidates: HomeAction[] = [
    { href: "/approvals", label: "Review approvals" },
    { href: "/search", label: "Search records" },
    { href: "/guests", label: "Open guests" },
    { href: "/attendance", label: "Open attendance" },
    { href: "/finance", label: "Open finance" },
    { href: "/reports", label: "View reports" },
  ];

  for (const candidate of secondaryCandidates) {
    if (!canAccessRoute(user.role, candidate.href)) {
      continue;
    }

    if (actions.some((action) => action.href === candidate.href)) {
      continue;
    }

    actions.push({ ...candidate, kind: "secondary" });

    if (actions.length >= 3) {
      break;
    }
  }

  return actions;
}

function getSignedInStats(user: SessionUser) {
  return [
    { label: "Role", value: formatRoleLabel(user.role) },
    { label: "Scope", value: getUserScopeLabel(user) || "Assigned workspace" },
    { label: "Account", value: user.email },
  ];
}

export default async function HomePage() {
  const [settings, user] = await Promise.all([
    getPublicSettings(),
    getOptionalSessionUser(),
  ]);

  const actions = getHomeActions(user);
  const headline = user ? getLoggedInHeadline(user) : "Keep data flowing, not scattered.";
  const description = user
    ? getLoggedInDescription(user)
    : "Sign in with your provisioned workspace account and continue ministry operations from one place.";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f8f6f1] via-[#f3efe6] to-white text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.05),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-start px-6 py-10 sm:py-12 lg:items-center lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12">
          <section className="max-w-2xl">
            <div className="mb-8 inline-flex items-center gap-4 sm:mb-10 sm:gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white ring-1 ring-black/5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:h-20 sm:w-20 sm:rounded-[28px]">
                <Image
                  src="/Churchflow.png"
                  alt="ChuFlow logo"
                  width={68}
                  height={68}
                  priority
                  className="h-12 w-12 object-contain sm:h-16 sm:w-16"
                />
              </div>
              <div>
                <h2 className="heading text-3xl font-semibold leading-none tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                  <span className="text-slate-950">Chu</span>
                  <span className="bg-gradient-to-r from-[#D4AF37] via-[#b45309] to-[#9a3412] bg-clip-text text-transparent">
                    Flow
                  </span>
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {settings.organizationTagline}
                </p>
              </div>
            </div>

            {user ? (
              <p className="eyebrow">Welcome back, {user.firstName}</p>
            ) : null}

            <h1 className="heading max-w-3xl text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-6xl">
              {headline}
            </h1>

            <p className="mt-5 max-w-md text-base leading-7 text-slate-600 sm:mt-7 sm:text-lg sm:leading-8">
              {description}
            </p>

            <div className="mt-7 max-w-md sm:mt-8">
              <Link
                href={actions[0]?.href || "/login"}
                className="block rounded-2xl bg-slate-950 px-6 py-4 text-center text-base font-semibold text-white transition hover:bg-slate-800"
              >
                {actions[0]?.label || "Sign in to your workspace"}
              </Link>
            </div>

            {!user ? (
              <div className="mt-8 space-y-4 text-base text-slate-700 sm:mt-10">
                <p>
                  Looking for another workspace?{" "}
                  <Link href="/login" className="font-semibold text-slate-950 underline underline-offset-4">
                    Find your workspace
                  </Link>
                </p>
                <p>
                  Need a new church workspace?{" "}
                  <Link
                    href="/request-workspace"
                    className="font-semibold text-slate-950 underline underline-offset-4"
                  >
                    Request workspace
                  </Link>
                </p>
              </div>
            ) : (
              <div className="mt-8 grid max-w-md gap-3 sm:mt-10">
                {getSignedInStats(user).map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-black/6 bg-white/78 px-4 py-4 shadow-sm backdrop-blur"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {item.value}
                    </p>
                  </div>
                ))}
                {actions.length > 1 ? (
                  <div className="rounded-2xl border border-black/6 bg-white/78 px-4 py-4 shadow-sm backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Quick links
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.slice(1).map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="relative flex items-center justify-center">
            <div className="w-full lg:hidden">
              <div className="rounded-[32px] border border-black/5 bg-white/72 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-black/5 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                    National
                  </div>
                  <div className="rounded-full border border-black/5 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                    District
                  </div>
                  <div className="rounded-full border border-black/5 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                    Branch
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { name: "National", tone: "bg-orange-400", short: "Na" },
                    { name: "District", tone: "bg-cyan-400", short: "Di" },
                    { name: "Branch", tone: "bg-emerald-400", short: "Br" },
                    { name: "Guests", tone: "bg-rose-400", short: "Gu" },
                    { name: "Members", tone: "bg-amber-300", short: "Me" },
                    { name: "Follow-up", tone: "bg-indigo-400", short: "Fo" },
                  ].map((node) => (
                    <div
                      key={node.name}
                      className="rounded-[24px] border border-black/5 bg-white px-3 py-4 text-center shadow-sm"
                    >
                      <div
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold text-slate-950 ${node.tone}`}
                      >
                        {node.short}
                      </div>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {node.name}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-600">
                  {user
                    ? `${formatRoleLabel(user.role)} access is ready.`
                    : "Built for churches with national, district, and branch structure."}
                </p>
              </div>
            </div>

            <div className="relative hidden w-full max-w-3xl lg:block">
              <div className="absolute bottom-4 h-44 w-[90%] rounded-[50%] bg-slate-900/10 blur-sm" />
              <div className="mx-auto aspect-square max-w-[40rem] rounded-full border border-black/6 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(255,255,255,0.55)_45%,rgba(148,163,184,0.16)_100%)] p-8 shadow-[0_40px_100px_rgba(15,23,42,0.12)]">
                <div className="relative h-full w-full rounded-full border border-dashed border-[#D4AF37]/40">
                  <div className="absolute left-[14%] top-[22%] h-[26%] w-[28%] rounded-[42%_58%_45%_55%/50%_40%_60%_50%] bg-slate-900/8" />
                  <div className="absolute left-[42%] top-[17%] h-[20%] w-[24%] rounded-[55%_45%_60%_40%/58%_48%_52%_42%] bg-slate-900/6" />
                  <div className="absolute left-[52%] top-[42%] h-[18%] w-[18%] rounded-[50%] bg-slate-900/7" />
                  <div className="absolute left-[29%] top-[50%] h-[25%] w-[24%] rounded-[48%_52%_44%_56%/58%_42%_58%_42%] bg-slate-900/6" />
                  <div className="absolute left-[68%] top-[28%] h-[17%] w-[15%] rounded-[48%_52%_44%_56%/58%_42%_58%_42%] bg-slate-900/6" />
                  <div className="absolute left-[64%] top-[58%] h-[22%] w-[15%] rounded-[48%_52%_44%_56%/58%_42%_58%_42%] bg-slate-900/8" />

                  <div className="absolute inset-0">
                    <div className="absolute left-[17%] top-[28%] h-px w-[48%] rotate-[14deg] border-t border-dashed border-[#D4AF37]/55" />
                    <div className="absolute left-[28%] top-[56%] h-px w-[48%] -rotate-[24deg] border-t border-dashed border-[#D4AF37]/55" />
                    <div className="absolute left-[43%] top-[30%] h-[37%] w-px rotate-[16deg] border-l border-dashed border-[#D4AF37]/55" />
                    <div className="absolute left-[21%] top-[53%] h-px w-[47%] rotate-[8deg] border-t border-dashed border-[#D4AF37]/55" />
                  </div>

                  {[
                    { name: "National", tone: "bg-orange-400", pos: "left-[10%] top-[18%]" },
                    { name: "District", tone: "bg-cyan-400", pos: "left-[70%] top-[13%]" },
                    { name: "Branch", tone: "bg-emerald-400", pos: "left-[58%] top-[43%]" },
                    { name: "Guests", tone: "bg-rose-400", pos: "left-[8%] top-[53%]" },
                    { name: "Members", tone: "bg-amber-300", pos: "left-[34%] top-[78%]" },
                    { name: "Follow-up", tone: "bg-indigo-400", pos: "left-[78%] top-[66%]" },
                  ].map((node) => (
                    <div key={node.name} className={`absolute ${node.pos}`}>
                      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-black/5 bg-white/75 shadow-lg backdrop-blur-xl">
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-full text-xs font-semibold text-slate-950 ${node.tone}`}
                        >
                          {node.name.slice(0, 2)}
                        </div>
                      </div>
                      <p className="mt-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {node.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute left-4 top-6 rounded-2xl border border-black/5 bg-white/78 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur-xl">
                {user ? "Signed-in workspace ready" : "Centralized ministry operating system"}
              </div>
              <div className="absolute bottom-10 right-6 rounded-2xl border border-black/5 bg-white/78 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur-xl">
                {user ? formatRoleLabel(user.role) : "Built for churches with branch hierarchy"}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
