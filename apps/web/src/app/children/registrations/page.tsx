import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { ParentRegistrationLink } from "@/components/children/registration-review";
import { initials } from "@/components/children/records-utils";
import type { ChildrenOptions } from "@/lib/children";
type Queue = ChildrenOptions & {
  branchId: string;
  items: {
    _id: string;
    familyName: string;
    status: string;
    createdAt?: string;
  }[];
  pagination: { page: number; total: number; totalPages: number };
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; page?: string }>;
}) {
  const q = await searchParams;
  const params = new URLSearchParams();
  if (q.branchId) params.set("branchId", q.branchId);
  if (q.page) params.set("page", q.page);
  const [data, t, format] = await Promise.all([
    serverGet<Queue>(`/children/registrations?${params}`),
    getTranslations("childrenRecords"),
    getFormatter(),
  ]);
  type Key = Parameters<typeof t>[0];
  const statusLabel = (s: string) => {
    const key = `queue.status.${s}` as Key;
    return t.has(key) ? t(key) : s;
  };
  const tone = (s: string) =>
    s === "pending" ? "amber" : s === "processing" ? "blue" : s === "rejected" ? "rose" : "";
  const now = new Date();
  const pageHref = (page: number) =>
    `/children/registrations?branchId=${encodeURIComponent(data.branchId)}&page=${page}`;
  return (
    <div className="space-y-6 kids-fade-in">
      <Link className="kids-chip" href="/children">
        {t("back.workspace")}
      </Link>
      <section className="children-panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="children-kicker">{t("queue.kicker")}</p>
            <h1 className="mt-2 text-3xl font-bold">{t("queue.title")}</h1>
            <p className="children-muted mt-3 max-w-2xl">{t("queue.intro")}</p>
          </div>
          {data.branches.length > 1 && (
            <form className="flex flex-wrap gap-3">
              <select
                className="children-input max-w-md"
                name="branchId"
                defaultValue={data.branchId}
                aria-label={t("queue.churchLabel")}
              >
                {data.branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button className="children-button secondary">{t("queue.openChurch")}</button>
            </form>
          )}
        </div>
        <div className="kids-stats mt-6">
          <div className={`kids-stat ${data.pagination.total ? "amber" : "green"}`}>
            <span className="kids-stat-value">{data.pagination.total}</span>
            <span className="kids-stat-label">{t("queue.statPending")}</span>
            <span className="kids-stat-hint">{t("queue.statPendingHint")}</span>
          </div>
          <div className="kids-stat">
            <span className="kids-stat-value">{data.items.length}</span>
            <span className="kids-stat-label">{t("queue.statPage")}</span>
          </div>
          <div className="kids-stat blue">
            <span className="kids-stat-value">
              {data.pagination.page}
              <span className="text-base font-semibold text-[#8a9589]">
                {" "}
                / {data.pagination.totalPages}
              </span>
            </span>
            <span className="kids-stat-label">{t("queue.statPages")}</span>
          </div>
        </div>
      </section>

      <ParentRegistrationLink key={data.branchId} branchId={data.branchId} />

      <section className="children-panel">
        <h2 className="text-xl font-bold">{t("queue.listTitle")}</h2>
        <div className="mt-4">
          {data.items.map((r) => (
            <Link
              key={r._id}
              href={`/children/registrations/${r._id}`}
              className="kids-row"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="kids-avatar">{initials(r.familyName)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.familyName}</span>
                  {r.createdAt && (
                    <span className="children-muted block text-xs">
                      {t("queue.submitted", {
                        when: format.relativeTime(new Date(r.createdAt), now),
                      })}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`children-badge ${tone(r.status)}`}>
                  {statusLabel(r.status)}
                </span>
                <span className="text-sm font-semibold text-[#245b4b]">
                  {t("queue.review")}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {!data.items.length && (
          <div className="kids-empty mt-4">
            <span className="kids-empty-icon" aria-hidden="true">
              🎉
            </span>
            <strong>{t("queue.empty")}</strong>
            <span>{t("queue.emptyHint")}</span>
          </div>
        )}
        {data.pagination.totalPages > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="children-muted">
              {t("queue.pageOf", {
                page: data.pagination.page,
                total: data.pagination.totalPages,
              })}
            </span>
            <div className="flex gap-2">
              {data.pagination.page > 1 && (
                <Link className="kids-chip" href={pageHref(data.pagination.page - 1)}>
                  {t("queue.previous")}
                </Link>
              )}
              {data.pagination.page < data.pagination.totalPages && (
                <Link className="kids-chip" href={pageHref(data.pagination.page + 1)}>
                  {t("queue.next")}
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
