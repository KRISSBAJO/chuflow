import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { YouthSetup } from "@/components/youth/youth-setup";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { YouthOverview } from "@/lib/youth";

export default async function YouthPage() {
  const user = await requireServerRole("/youth");
  const [t, format, overview] = await Promise.all([getTranslations("youth"), getFormatter(), serverGet<YouthOverview>("/youth")]);
  return <Shell><main className="mx-auto max-w-5xl space-y-6">
    <PageHeader eyebrow={t("ministry")} title={t("title")} description={t("overview")} />
    <section className="grid gap-3 sm:grid-cols-2">
      {overview.groups.map(group => {
        const info = <><p className="text-sm text-neutral-600">{group.program} · {group.branchName}</p>
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <p className="mt-2 text-sm">{t("counts", { active: format.number(group.active), pending: format.number(group.pending) })}</p>
          <p className="mt-1 text-sm text-neutral-600">{t("attendanceCounts", { sessions: format.number(group.sessions), visits: format.number(group.visits) })}</p></>;
        return group.canOpen ? <Link key={group._id} className="app-card block p-5 hover:ring-1 hover:ring-orange-500" href={`/youth/${group._id}`}>{info}</Link>
          : <article key={group._id} className="app-card p-5">{info}</article>;
      })}
    </section>
    {!overview.groups.length ? <p className="app-card p-5">{t("noGroups")}</p> : null}
    {overview.canManage && overview.branches.length ? <YouthSetup overview={overview} defaultBranch={typeof user.branchId === "string" ? user.branchId : undefined} /> : null}
  </main></Shell>;
}
