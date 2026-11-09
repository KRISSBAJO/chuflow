import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { YouthSetup } from "@/components/youth/youth-setup";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { YouthOverview } from "@/lib/youth";

export default async function YouthPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireServerRole("/youth");
  const [t, format, overview] = await Promise.all([getTranslations("youth"), getFormatter(), serverGet<YouthOverview>("/youth")]);
  const view = (await searchParams).view;
  const camps = view === "camps";
  const events = view === "events";
  const groups = overview.groups.filter(group => camps ? group.campEndDate : events ? group.eventDate && !group.campEndDate : !group.eventDate);
  return <Shell><main className="mx-auto max-w-5xl space-y-6">
    <PageHeader eyebrow={t("ministry")} title={t("title")} description={t("overview")} />
    <nav aria-label={t("title")} className="flex flex-wrap gap-2">
      <Link href="/youth" aria-current={!events && !camps ? "page" : undefined} className="rounded-full border border-black/10 px-4 py-2 text-sm aria-[current=page]:bg-black aria-[current=page]:text-white">{t("groups")}</Link>
      <Link href="/youth?view=events" aria-current={events ? "page" : undefined} className="rounded-full border border-black/10 px-4 py-2 text-sm aria-[current=page]:bg-black aria-[current=page]:text-white">{t("events")}</Link>
      <Link href="/youth?view=camps" aria-current={camps ? "page" : undefined} className="rounded-full border border-black/10 px-4 py-2 text-sm aria-[current=page]:bg-black aria-[current=page]:text-white">{t("camps")}</Link>
    </nav>
    <section className="grid gap-3 sm:grid-cols-2">
      {groups.map(group => {
        const info = <><p className="text-sm text-neutral-600">{group.program} · {group.branchName}</p>
          <h2 className="text-lg font-semibold">{group.name}</h2>
          {group.eventDate ? <p className="mt-1 text-sm">{format.dateTime(new Date(group.eventDate), { dateStyle: "medium", timeZone: "UTC" })} · {group.venue}</p> : null}
          <p className="mt-2 text-sm">{t("counts", { active: format.number(group.active), pending: format.number(group.pending) })}</p>
          {group.capacity ? <p className="mt-1 text-sm">{t("eventCapacity", { count: group.active, total: group.capacity })}</p> : null}
          <p className="mt-1 text-sm text-neutral-600">{t("attendanceCounts", { sessions: format.number(group.sessions), visits: format.number(group.visits) })}</p></>;
        return group.canOpen ? <Link key={group._id} className="app-card block p-5 hover:ring-1 hover:ring-orange-500" href={group.campEndDate ? `/youth/camps/${group._id}` : `/youth/${group._id}`}>{info}</Link>
          : <article key={group._id} className="app-card p-5">{info}</article>;
      })}
    </section>
    {!groups.length ? <p className="app-card p-5">{t(camps ? "noCamps" : events ? "noEvents" : "noGroups")}</p> : null}
    {(events || camps ? overview.canManageEvents : overview.canManage) && overview.branches.length ? <YouthSetup camps={camps} events={events} overview={overview} defaultBranch={typeof user.branchId === "string" ? user.branchId : undefined} /> : null}
  </main></Shell>;
}
