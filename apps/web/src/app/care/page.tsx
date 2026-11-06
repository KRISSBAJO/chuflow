import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { Icon } from "@/components/app/icons";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  careLabel,
  isCareLabelValue,
  type CareRecord,
  type CareOverview,
  type CareOptions,
} from "@/lib/care";
export default async function CareHub({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/care");
  const [t, tCare, tc, tsh, format] = await Promise.all([
    getTranslations("people.care.hub"),
    getTranslations("people.care"),
    getTranslations("common"),
    getTranslations("people.shared"),
    getFormatter(),
  ]);
  const label = (value: string) => (isCareLabelValue(value) ? tCare(`labels.${value}`) : careLabel(value));
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["branchId", "view", "q", "page"])
    if (typeof params[key] === "string" && params[key]?.trim())
      query.set(key, params[key]!);
  const [options, report, list] = await Promise.all([
    serverGet<CareOptions>("/care/options"),
    serverGet<CareOverview>(
      `/care/overview${query.get("branchId") ? "?branchId=" + query.get("branchId") : ""}`,
    ),
    serverGet<{
      items: CareRecord[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/care/cases?${query}`),
  ]);
  const href = (view: string, page = 1) => {
    const q = new URLSearchParams(query);
    q.set("view", view);
    q.set("page", String(page));
    return "/care?" + q;
  };
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex gap-2">
            <Link className={buttonClass("secondary")} href="/follow-up">
              {t("guestTasks")}
            </Link>
            {options.isAdmin && (
              <Link className={buttonClass()} href="/care/settings">
                {t("automationSettings")}
              </Link>
            )}
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("people"), report.total, "all"],
          [t("needOwner"), report.unassigned, "unassigned"],
          [t("overdueTasks"), report.overdue, "overdue"],
          [t("participationGaps"), report.retention, "retention"],
        ].map(([label, value, view]) => (
          <Link className="app-card p-5" href={href(String(view))} key={label}>
            <p className="text-xs text-[#6b6b6b]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {format.number(Number(value))}
            </p>
          </Link>
        ))}
      </section>
      <details className="app-card p-5">
        <summary className="cursor-pointer font-medium">
          {t("briefing")}
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <ul className="space-y-2 text-sm">
            {report.briefing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="space-y-2 text-sm">
            <p>{t("cohortGuests", { count: report.cohort.guests })}</p>
            <p>{t("cohortContacted", { count: report.cohort.contacted24h })}</p>
            <p>{t("cohortReturned", { returned: report.cohort.returned, members: report.cohort.becameMembers })}</p>
            <p className="text-xs text-[#8a8780]">
              {t("observedNote")}
            </p>
          </div>
        </div>
      </details>
      <details className="app-card p-5"><summary className="cursor-pointer font-medium">{t("cohortsTitle")}</summary><div className="mt-4 overflow-x-auto"><table className="ui-table w-full"><thead><tr><th>{t("registrationWeek")}</th><th>{t("guests")}</th><th>{t("contact24h")}</th><th>{t("return30d")}</th><th>{t("linkedMembership")}</th></tr></thead><tbody>{report.cohorts.map(row=><tr key={row._id}><td>{row._id}</td><td>{row.guests}</td><td>{row.contacted24h}</td><td>{row.returned30}</td><td>{row.members}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-[#8a8780]">{t("cohortsNote")}</p></div></details>
      <nav
        className="flex gap-1 overflow-x-auto border-b border-black/10"
        aria-label={t("queuesAria")}
      >
        {[
          "today",
          "mine",
          "unassigned",
          "overdue",
          "escalated",
          "retention",
          "all",
        ].map((view) => (
          <Link
            key={view}
            href={href(view)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${(query.get("view") || "all") === view ? "border-[#ed7b19] font-semibold text-[#b94f0a]" : "border-transparent text-[#6b6b6b]"}`}
          >
            {view === "retention" ? t("participationChecks") : label(view)}
          </Link>
        ))}
      </nav>
      <Card className="p-5">
        <FilterPanel><form className="flex flex-wrap gap-3">
          <input type="hidden" name="view" value={query.get("view") || "all"} />
          <input
            className="ui-input min-w-48 flex-1"
            aria-label={t("searchAria")}
            name="q"
            defaultValue={query.get("q") || ""}
            placeholder={t("searchPlaceholder")}
          />
          <select
            className="ui-input max-w-xs"
            aria-label={tc("branch")}
            name="branchId"
            defaultValue={query.get("branchId") || ""}
          >
            <option value="">{t("allAccessibleBranches")}</option>
            {options.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className={buttonClass("secondary")}>{tc("search")}</button>
        </form></FilterPanel>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">{t("matching", { count: list.total })}</p>
          <span className="text-xs text-[#8a8780]">
            {t("sourcesSync")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="ui-table w-full">
            <thead>
              <tr>
                <th>{t("person")}</th>
                <th>{t("journey")}</th>
                <th>{t("owner")}</th>
                <th>{t("nextAction")}</th>
                <th>{tsh("stage")}</th>
                <th>
                  <span className="sr-only">{tc("open")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <tr key={c._id}>
                  <td>
                    <Link className="font-medium" href={"/care/" + c._id}>
                      {c.firstName} {c.lastName}
                    </Link>
                    <p className="text-xs text-[#8a8780]">
                      {typeof c.branchId === "object"
                        ? c.branchId.name
                        : label(c.personType)}
                    </p>
                  </td>
                  <td>{label(c.journey)}</td>
                  <td>
                    {typeof c.ownerId === "object"
                      ? `${c.ownerId.firstName} ${c.ownerId.lastName}`
                      : tsh("unassigned")}
                  </td>
                  <td>
                    {c.nextTask ? (
                      <>
                        <p>{c.nextTask.title}</p>
                        <p className="text-xs text-[#8a8780]">
                          {tsh("utc", { date: format.dateTime(new Date(c.nextTask.dueAt), { timeZone: "UTC", dateStyle: "short" }) })}
                          {c.nextTask.escalated ? ` · ${t("escalated")}` : ""}
                        </p>
                      </>
                    ) : (
                      t("noOpenTask")
                    )}
                  </td>
                  <td>
                    {c.stopContact ? t("contactStopped") : label(c.stage)}
                  </td>
                  <td>
                    <Link
                      href={"/care/" + c._id}
                      aria-label={t("openCare", { name: `${c.firstName} ${c.lastName}` })}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Icon name="arrowUpRight" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.items.length && (
            <p className="py-8 text-center text-sm text-[#8a8780]">
              {t("empty")}
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>
            {tc("pageOf", { page: list.page, total: list.totalPages })}
          </span>
          <div className="flex gap-2">
            {list.page > 1 && (
              <Link
                className={buttonClass("secondary", "sm")}
                href={href(query.get("view") || "all", list.page - 1)}
              >
                {tc("previous")}
              </Link>
            )}
            {list.page < list.totalPages && (
              <Link
                className={buttonClass("secondary", "sm")}
                href={href(query.get("view") || "all", list.page + 1)}
              >
                {tc("next")}
              </Link>
            )}
          </div>
        </div>
      </Card>
    </Shell>
  );
}
