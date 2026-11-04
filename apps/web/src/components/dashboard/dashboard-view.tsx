import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import type { SessionUser } from "@/lib/auth";
import { canAccessRoute, formatRoleLabel } from "@/lib/permissions";
import type { DashboardBranchAlert, DashboardOverview } from "@/lib/types";
import { BranchHealth } from "./branch-health";

type Operational = NonNullable<DashboardOverview["operational"]>;

const numberFormatter = new Intl.NumberFormat("en-US");
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Follow-up stages in workflow order. */
const STAGE_ORDER = ["new", "assigned", "contacted", "prayed_with", "invited_back", "returned", "converted"];
/** One flame hue, light to dark, validated as an ordinal ramp (dataviz validate_palette --ordinal). */
const STAGE_RAMP = ["#f2a35e", "#e0823a", "#c96727", "#ad501b", "#8f3e14", "#70300f", "#52230a"];

export function buildDashboardHref(filters: { days?: number | string; oversightRegion?: string; district?: string; branchId?: string }) {
  const query = new URLSearchParams();
  if (filters.days) query.set("days", String(filters.days));
  if (filters.oversightRegion) query.set("oversightRegion", filters.oversightRegion);
  if (filters.district) query.set("district", filters.district);
  if (filters.branchId) query.set("branchId", filters.branchId);
  const queryString = query.toString();
  return queryString ? `/dashboard?${queryString}` : "/dashboard";
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatLabel(value: string) {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.round((date.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return "today";
  if (Math.abs(days) < 30) return relativeFormatter.format(days, "day");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(...parts: (string | undefined)[]) {
  return parts
    .filter(Boolean)
    .map((part) => part![0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CardHeader({ label, title, action }: { label: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-[#6b6b6b]">{label}</p>
        <h2 className="lp-heading mt-1 text-[22px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#f6f5f1]">
      {children}
      <Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f6f5f1] px-5 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8a8780]">
        <Icon name={icon} />
      </span>
      <p className="max-w-[280px] text-[14px] leading-[1.55] text-[#6b6b6b]">{children}</p>
    </div>
  );
}

function StatTile({
  label,
  value,
  caption,
  icon,
  href,
  highlight,
  delay,
}: {
  label: string;
  value: number;
  caption: string;
  icon: IconName;
  href?: string;
  highlight?: boolean;
  delay: number;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${highlight ? "lp-flame-bg text-white" : "bg-[#f6f5f1] text-[#55534e]"}`}
        >
          <Icon name={icon} className="h-[15px] w-[15px]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#55534e]">{label}</p>
        {href ? (
          <Icon name="arrowUpRight" className="h-3.5 w-3.5 shrink-0 text-[#c4c1ba] transition-colors group-hover:text-[var(--lp-ink)]" />
        ) : null}
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--lp-ink)]">
        {formatCount(value)}
      </p>
      <p className="mt-1.5 truncate text-[12px] text-[#8a8780]">{caption}</p>
    </>
  );

  const className =
    "app-card app-rise group block px-5 py-4 transition-colors duration-200 hover:border-black/[0.12]";

  return href ? (
    <Link href={href} className={className} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </Link>
  ) : (
    <div className={className} style={{ animationDelay: `${delay}ms` }}>
      {body}
    </div>
  );
}

function WatchRow({ item, href, detail }: { item: DashboardBranchAlert; href: string; detail: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#f6f5f1]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-[var(--lp-ink)]">{item.name}</span>
          <span className="block truncate text-[12px] text-[#8a8780]">
            {[item.district, [item.city, item.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          </span>
        </span>
        {detail}
      </Link>
    </li>
  );
}

/** Shows the first few rows and tucks the rest behind a native "Show N more" toggle. */
function WatchItems<T>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const visible = items.slice(0, 4);
  const hidden = items.slice(4);
  return (
    <>
      <ul className="mt-2">{visible.map(render)}</ul>
      {hidden.length ? (
        <details className="group">
          <summary className="mx-2 mt-1 flex cursor-pointer list-none items-center gap-1.5 rounded-lg py-1.5 text-[13px] font-medium text-[#55534e] hover:text-[var(--lp-ink)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {hidden.length} more</span>
            <span className="hidden group-open:inline">Show less</span>
            <Icon name="chevronDown" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <ul>{hidden.map(render)}</ul>
        </details>
      ) : null}
    </>
  );
}

function Watchlist({ dashboard }: { dashboard: DashboardOverview }) {
  const days = dashboard.scope.days;
  const missing = dashboard.executive.branchesWithoutRecentAttendance;
  const backlog = dashboard.executive.highFollowUpBacklog;
  const maxBacklog = Math.max(1, ...backlog.map((item) => item.pendingFollowUp ?? 0));

  return (
    <section className="app-card flex flex-col p-6 sm:p-7">
      <CardHeader label="Watchlist" title="Needs your attention" />

      <div className="mt-6">
        <div className="flex items-center justify-between px-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--lp-ink)]">
            <Icon name="clock" className="h-4 w-4 text-[#ea580c]" />
            No recent attendance
          </p>
          <span className="rounded-full bg-[#f6f5f1] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--lp-ink)]">
            {missing.length}
          </span>
        </div>
        {missing.length ? (
          <WatchItems
            items={missing}
            render={(item) => (
              <WatchRow
                key={item._id}
                item={item}
                href={buildDashboardHref({ days, branchId: item._id })}
                detail={
                  <span className="shrink-0 text-[12px] text-[#8a8780]">
                    {relativeDate(item.lastSubmittedAt) ? `Last ${relativeDate(item.lastSubmittedAt)}` : "Never reported"}
                  </span>
                }
              />
            )}
          />
        ) : (
          <p className="mt-2 px-2 text-[13px] text-[#8a8780]">Every branch has reported recently.</p>
        )}
      </div>

      <div className="mt-5 border-t border-black/[0.06] pt-5">
        <div className="flex items-center justify-between px-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--lp-ink)]">
            <Icon name="care" className="h-4 w-4 text-[#ea580c]" />
            Follow-up backlog
          </p>
          <span className="rounded-full bg-[#f6f5f1] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--lp-ink)]">
            {backlog.length}
          </span>
        </div>
        {backlog.length ? (
          <WatchItems
            items={backlog}
            render={(item) => (
              <WatchRow
                key={item._id}
                item={item}
                href={buildDashboardHref({ days, branchId: item._id })}
                detail={
                  <span className="flex shrink-0 items-center gap-2" title={`${item.pendingFollowUp ?? 0} pending`}>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#f1f0ec]">
                      <span
                        className="app-bar block h-full rounded-full bg-[#ea580c]"
                        style={{ width: `${Math.max(6, ((item.pendingFollowUp ?? 0) / maxBacklog) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 text-right text-[13px] font-semibold tabular-nums text-[var(--lp-ink)]">
                      {formatCount(item.pendingFollowUp ?? 0)}
                    </span>
                  </span>
                }
              />
            )}
          />
        ) : (
          <p className="mt-2 px-2 text-[13px] text-[#8a8780]">No follow-up backlog is building up.</p>
        )}
      </div>
    </section>
  );
}

function FollowUpPipeline({ pipeline, href }: { pipeline: Operational["followUpPipeline"]; href?: string }) {
  const stages = [...pipeline].sort((left, right) => {
    const a = STAGE_ORDER.indexOf(left.status);
    const b = STAGE_ORDER.indexOf(right.status);
    return (a === -1 ? 99 : a) - (b === -1 ? 99 : b);
  });
  const total = stages.reduce((sum, stage) => sum + stage.total, 0);
  const colorFor = (status: string, index: number) => STAGE_RAMP[STAGE_ORDER.indexOf(status)] ?? STAGE_RAMP[index % STAGE_RAMP.length];

  return (
    <section className="app-card flex flex-col p-6 sm:p-7">
      <CardHeader
        label="Follow-up pipeline"
        title={`${formatCount(total)} ${total === 1 ? "person" : "people"} in care`}
        action={href ? <CardLink href={href}>Open follow-up</CardLink> : null}
      />

      {total > 0 ? (
        <>
          <div className="mt-7 flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of people at each follow-up stage">
            {stages
              .filter((stage) => stage.total > 0)
              .map((stage, index) => (
                <span
                  key={stage.status}
                  title={`${formatLabel(stage.status)}: ${formatCount(stage.total)} (${Math.round((stage.total / total) * 100)}%)`}
                  className="app-bar h-full first:rounded-l-full last:rounded-r-full"
                  style={{ flexGrow: stage.total, flexBasis: 0, backgroundColor: colorFor(stage.status, index), animationDelay: `${index * 70}ms` }}
                />
              ))}
          </div>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-4">
            {stages.map((stage, index) => (
              <li key={stage.status} className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ backgroundColor: colorFor(stage.status, index) }} />
                <span className="flex-1 text-[14px] text-[var(--lp-ink)]">{formatLabel(stage.status)}</span>
                <span className="text-[14px] font-semibold tabular-nums text-[var(--lp-ink)]">{formatCount(stage.total)}</span>
                <span className="w-10 text-right text-[12px] tabular-nums text-[#8a8780]">
                  {Math.round((stage.total / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-6">
          <Empty icon="care">Nobody is in the follow-up pipeline in this scope right now.</Empty>
        </div>
      )}
    </section>
  );
}

function AttendanceByService({ mix, href }: { mix: Operational["attendanceMix"]; href?: string }) {
  const services = [...mix].sort((left, right) => right.totalPeople - left.totalPeople);
  const max = Math.max(1, ...services.map((service) => service.totalPeople));

  return (
    <section className="app-card flex flex-col p-6 sm:p-7">
      <CardHeader label="Attendance by service" title="Who came to church" action={href ? <CardLink href={href}>Attendance</CardLink> : null} />
      {services.length ? (
        <ul className="mt-6 space-y-5">
          {services.map((service, index) => (
            <li key={service._id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-medium text-[var(--lp-ink)]">{formatLabel(service._id)}</span>
                <span className="text-[15px] font-semibold tabular-nums text-[var(--lp-ink)]">{formatCount(service.totalPeople)}</span>
              </div>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#f1f0ec]">
                <span
                  className="app-bar block h-full rounded-full bg-[#ea580c]"
                  style={{ width: `${Math.max(3, (service.totalPeople / max) * 100)}%`, animationDelay: `${index * 80}ms` }}
                />
              </span>
              <p className="mt-1.5 text-[12px] text-[#8a8780]">
                {formatCount(service.firstTimers)} first timers · {formatCount(service.newConverts)} converts ·{" "}
                {formatCount(service.summarySubmissions)} reports
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <Empty icon="attendance">No attendance has been recorded in this range yet.</Empty>
        </div>
      )}
    </section>
  );
}

function PeopleList({
  label,
  title,
  href,
  emptyIcon,
  emptyText,
  people,
}: {
  label: string;
  title: string;
  href?: string;
  emptyIcon: IconName;
  emptyText: string;
  people: { id: string; name: string; initials: string; branch: string; status: string; date: string | null; link?: string }[];
}) {
  return (
    <section className="app-card flex flex-col p-6 sm:p-7">
      <CardHeader label={label} title={title} action={href ? <CardLink href={href}>View all</CardLink> : null} />
      {people.length ? (
        <ul className="mt-5 divide-y divide-black/[0.05]">
          {people.slice(0, 8).map((person) => {
            const row = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f5f1] text-[13px] font-semibold text-[var(--lp-ink)]">
                  {person.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--lp-ink)]">{person.name}</span>
                  <span className="block truncate text-[12px] text-[#8a8780]">
                    {person.branch}
                    {person.date ? ` · ${person.date}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[#f6f5f1] px-2.5 py-1 text-[12px] font-medium text-[var(--lp-ink)]">
                  {person.status}
                </span>
              </>
            );
            return (
              <li key={person.id}>
                {person.link ? (
                  <Link href={person.link} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5">
          <Empty icon={emptyIcon}>{emptyText}</Empty>
        </div>
      )}
    </section>
  );
}

function scopeHeadline(scope: DashboardOverview["scope"]) {
  if (scope.kind === "all_network") return "Here's your whole network at a glance.";
  if (scope.kind === "national") return `Here's ${scope.label} at a glance.`;
  if (scope.kind === "district") return `Here's ${scope.label} at a glance.`;
  return `Here's how ${scope.label} is doing.`;
}

export function DashboardView({
  dashboard,
  user,
  filterBar,
  showAllNetworkLink,
}: {
  dashboard: DashboardOverview;
  user: SessionUser;
  filterBar: ReactNode;
  showAllNetworkLink: boolean;
}) {
  const { scope, metrics } = dashboard;
  const can = (href: string) => canAccessRoute(user.role, href);
  const growthHrefs = Object.fromEntries(
    [...dashboard.executive.topGrowthBranches, ...dashboard.executive.bottomGrowthBranches].map((item) => [
      item._id,
      buildDashboardHref({ days: scope.days, branchId: item._id }),
    ]),
  );

  return (
    <>
      <div className="app-rise flex flex-col gap-5 pt-1 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="lp-label">
            {formatRoleLabel(user.role)} · {scope.label}
          </p>
          <h1 className="lp-heading mt-3 text-[2rem] leading-[1.08] sm:text-[2.6rem]">Welcome back, {user.firstName}.</h1>
          <p className="mt-2 text-[16px] text-[#6b6b6b]">{scopeHeadline(scope)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAllNetworkLink && scope.kind !== "all_network" ? (
            <Link
              href={buildDashboardHref({ days: scope.days })}
              className="inline-flex h-10 items-center rounded-xl border border-black/[0.07] bg-white px-4 text-[14px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#f6f5f1]"
            >
              All network
            </Link>
          ) : null}
          {can("/reports") ? (
            <Link href="/reports" className="lp-pill-dark inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-medium">
              Detailed reports
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {filterBar}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Guests"
          value={metrics.totalGuests}
          caption={`Guest records in ${scope.label}`}
          icon="guests"
          href={can("/guests") ? "/guests" : undefined}
          delay={0}
        />
        <StatTile
          label="Members"
          value={metrics.totalMembers}
          caption="Current membership in this scope"
          icon="members"
          href={can("/members") ? "/members" : undefined}
          delay={60}
        />
        <StatTile
          label="Attendance"
          value={metrics.totalAttendance}
          caption={`Recorded over the last ${scope.days} days`}
          icon="attendance"
          href={can("/attendance") ? "/attendance" : undefined}
          delay={120}
        />
        <StatTile
          label="Waiting for follow-up"
          value={metrics.pendingFollowUp}
          caption="New or assigned, not yet contacted"
          icon="care"
          href={can("/follow-up") ? "/follow-up" : undefined}
          highlight={metrics.pendingFollowUp > 0}
          delay={180}
        />
      </section>

      {scope.kind !== "branch" ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="h-full xl:col-span-2">
            <BranchHealth
              leaders={dashboard.executive.topGrowthBranches}
              attention={dashboard.executive.bottomGrowthBranches}
              hrefFor={growthHrefs}
            />
          </div>
          <Watchlist dashboard={dashboard} />
        </section>
      ) : null}

      {dashboard.operational ? (
        <>
          <section className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <FollowUpPipeline pipeline={dashboard.operational.followUpPipeline} href={can("/follow-up") ? "/follow-up" : undefined} />
            </div>
            <AttendanceByService mix={dashboard.operational.attendanceMix} href={can("/attendance") ? "/attendance" : undefined} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <PeopleList
              label="Guests"
              title="Recently welcomed"
              href={can("/guests") ? "/guests" : undefined}
              emptyIcon="guests"
              emptyText="No guests have been captured in this scope recently."
              people={dashboard.operational.recentGuests.map((guest) => ({
                id: guest._id,
                name: `${guest.firstName} ${guest.lastName}`,
                initials: initials(guest.firstName, guest.lastName),
                branch: guest.branchId?.name ?? "Branch",
                status: formatLabel(guest.visitStatus),
                date: relativeDate(guest.createdAt),
                link: can("/guests") ? `/guests/${guest._id}` : undefined,
              }))}
            />
            <PeopleList
              label="Members"
              title="Newest members"
              href={can("/members") ? "/members" : undefined}
              emptyIcon="members"
              emptyText="No new members have been added in this scope yet."
              people={dashboard.operational.newestMembers.map((member) => ({
                id: member._id,
                name: [member.title, member.firstName, member.lastName].filter(Boolean).join(" "),
                initials: initials(member.firstName, member.lastName),
                branch: member.branchId?.name ?? "Branch",
                status: formatLabel(member.membershipStatus),
                date: relativeDate(member.createdAt),
                link: can("/members") ? `/members/${member._id}` : undefined,
              }))}
            />
          </section>
        </>
      ) : (
        <section className="app-card flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="lp-flame-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
              <Icon name="pin" />
            </span>
            <div>
              <h2 className="lp-heading text-[20px]">Zoom in for live activity</h2>
              <p className="mt-1.5 max-w-xl text-[14px] leading-[1.6] text-[#6b6b6b]">
                Choose a district or branch above to see recent guests, newest members, the follow-up pipeline and
                attendance by service. They stay hidden at network level so this view stays fast as the church grows.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
