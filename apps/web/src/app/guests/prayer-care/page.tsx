import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PrayerCareCard, type PrayerCareQueue } from "@/components/prayer-care-card";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { canAccessPrayerCare } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";

export default async function PrayerCarePage({ searchParams }: { searchParams: Promise<{ page?: string; view?: string }> }) {
  const user = await requireServerRole("/guests/prayer-care");
  if (!canAccessPrayerCare(user.role)) redirect("/unauthorized");
  const [{ page, view }, t, common] = await Promise.all([searchParams, getTranslations("people.prayerCare"), getTranslations("common")]);
  const followUp = view === "follow_up";
  const query = new URLSearchParams({ page: page ?? "1", ...(followUp ? { view } : {}) });
  const queue = await serverGet<PrayerCareQueue>("/guests/prayer-care?" + query);
  const pageHref = (nextPage: number) => "?" + new URLSearchParams({ page: String(nextPage), ...(followUp ? { view } : {}) });
  return (
    <Shell>
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Link href="/guests" className="inline-flex min-h-11 items-center rounded-full border border-black/10 px-4 text-sm font-medium">{t("back")}</Link>
        <PageHeader eyebrow={t("private")} title={t("title")} description={t("description")} />
        <nav className="flex gap-2 text-sm" aria-label={t("title")}>
          <Link className="rounded-full border border-black/10 px-4 py-2 aria-[current=page]:bg-black aria-[current=page]:text-white" aria-current={!followUp ? "page" : undefined} href="/guests/prayer-care">{t("all")}</Link>
          <Link className="rounded-full border border-black/10 px-4 py-2 aria-[current=page]:bg-black aria-[current=page]:text-white" aria-current={followUp ? "page" : undefined} href="?view=follow_up">{t("status.follow_up")}</Link>
        </nav>
        {queue.items.length ? queue.items.map((item) => (
          <PrayerCareCard key={item.id} item={item}
            assignees={queue.canAssign ? queue.assignees.filter((person) => person.branchId === item.branch?._id) : undefined} />
        )) : <p className="rounded-2xl bg-[var(--lp-panel)] p-5">{t("empty")}</p>}
        {queue.totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label={t("title")}>
            {queue.page > 1 ? <Link href={pageHref(queue.page - 1)}>{common("back")}</Link> : null}
            <span>{t("page", { page: queue.page, total: queue.totalPages })}</span>
            {queue.page < queue.totalPages ? <Link href={pageHref(queue.page + 1)}>{t("next")}</Link> : null}
          </nav>
        ) : null}
      </div>
    </Shell>
  );
}
