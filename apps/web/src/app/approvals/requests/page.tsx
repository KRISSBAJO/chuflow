import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { FilterPanel } from "@/components/filter-panel";
import { Button, Card, Pagination, buttonClass } from "@/components/ui/ui";
import type { ApprovalList } from "@/lib/approval-workflows";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/approvals/requests");
  const t = await getTranslations("admin.approvalRequests");
  const format = await getFormatter();
  type Key = Parameters<typeof t>[0];
  const statusLabel = (value: string) => {
    const key = `status.${value}` as Key;
    return t.has(key) ? t(key) : value;
  };
  const q = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["search", "status", "view", "page"])
    if (q[key]) params.set(key, q[key]!);
  const data = await serverGet<ApprovalList>(
    `/approval-workflows/requests?${params}`,
  );
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/approvals/requests?${next}`;
  };
  return (
    <Shell>
      <Link href="/approvals" className="text-sm hover:underline">
        {t("backToApprovals")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex gap-2">
            {["super_admin", "national_admin"].includes(user.role) && (
              <Link
                className={buttonClass("secondary")}
                href="/approvals/routes"
              >
                {t("routes")}
              </Link>
            )}
            <Link
              className={buttonClass("primary")}
              href="/approvals/requests/new"
            >
              {t("newRequest")}
            </Link>
          </div>
        }
      />
      <FilterPanel>
        <form className="grid gap-3 sm:grid-cols-4">
          <input
            className="ui-input"
            name="search"
            aria-label={t("searchAria")}
            placeholder={t("searchPlaceholder")}
            defaultValue={q.search}
          />
          <select
            className="ui-input"
            name="status"
            aria-label={t("statusAria")}
            defaultValue={q.status || ""}
          >
            <option value="">{t("allStatuses")}</option>
            {(["pending", "approved", "returned", "rejected", "withdrawn"] as const).map(
              (s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ),
            )}
          </select>
          <select
            className="ui-input"
            name="view"
            aria-label={t("viewAria")}
            defaultValue={q.view || "all"}
          >
            <option value="all">{t("views.all")}</option>
            <option value="mine">{t("views.mine")}</option>
            <option value="review">{t("views.review")}</option>
            <option value="overdue">{t("views.overdue")}</option>
          </select>
          <Button type="submit">{t("applyFilters")}</Button>
          <Link href="/approvals/requests" className="text-sm hover:underline">
            {t("resetFilters")}
          </Link>
        </form>
      </FilterPanel>
      <Card className="p-5">
        <p className="mb-4 text-sm text-[#6b6b6b]">
          {t("matching", { count: data.pagination.total })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#8a8780]">
              <tr>
                {[
                  t("headers.request"),
                  t("headers.church"),
                  t("headers.status"),
                  t("headers.currentReview"),
                  t("headers.finalLevel"),
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r._id} className="border-t border-black/5">
                  <td className="px-3 py-4">
                    <Link
                      href={`/approvals/requests/${r._id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title} →
                    </Link>
                    <p className="mt-1 text-xs text-[#8a8780]">{r.category}</p>
                  </td>
                  <td className="px-3 py-4">{r.branchName}</td>
                  <td className="px-3 py-4">{statusLabel(r.status)}</td>
                  <td className="px-3 py-4">
                    {r.status === "pending" ? (
                      <>
                        {r.stages[r.currentStage]?.label}
                        <p
                          className={
                            new Date(r.dueAt) < new Date()
                              ? "text-xs text-red-700"
                              : "text-xs text-[#8a8780]"
                          }
                        >
                          {t("due", { date: format.dateTime(new Date(r.dueAt), { timeZone: "UTC" }) })}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-4">{t(`level.${r.finalLevel}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length && (
          <p className="py-8 text-center text-sm text-[#6b6b6b]">
            {t("noMatch")}
          </p>
        )}
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          prevHref={href(Math.max(1, data.pagination.page - 1))}
          nextHref={href(
            Math.min(data.pagination.totalPages, data.pagination.page + 1),
          )}
        />
      </Card>
    </Shell>
  );
}
