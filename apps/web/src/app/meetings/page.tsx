import { Icon } from "@/components/app/icons";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { Meeting, MeetingOptions } from "@/lib/meetings";

const MEETING_STATUSES = ["scheduled", "ongoing", "completed", "cancelled"] as const;
const MINUTES_STATUSES = ["overdue", "draft", "submitted", "approved", "changes_requested"] as const;

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireServerRole("/meetings");
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const key of [
    "q",
    "groupId",
    "branchId",
    "status",
    "minutes",
    "sort",
    "page",
    "from",
    "to",
    "actions",
    "upcoming",
  ])
    if (typeof raw[key] === "string" && raw[key].trim())
      query.set(key, raw[key]);
  const [result, options, t, tStatus, tMinutes, format] = await Promise.all([
    serverGet<{ items: Meeting[]; total: number; page: number; limit: number }>(
      `/meetings?${query}`,
    ),
    serverGet<MeetingOptions>("/meetings/options?mode=form"),
    getTranslations("services.meetings.list"),
    getTranslations("services.meetings.statuses"),
    getTranslations("services.meetings.minutesStatuses"),
    getFormatter(),
  ]);
  const statusLabel = (value: string) =>
    tStatus.has(value as (typeof MEETING_STATUSES)[number]) ? tStatus(value as (typeof MEETING_STATUSES)[number]) : value;
  const minutesLabel = (value: string) =>
    tMinutes.has(value as (typeof MINUTES_STATUSES)[number])
      ? tMinutes(value as (typeof MINUTES_STATUSES)[number])
      : value.replaceAll("_", " ");
  const activeFilters = [...query].filter(
    ([key, value]) => key !== "page" && (key !== "sort" || value !== "newest"),
  ).length;
  const pageLink = (page: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(page));
    return `/meetings?${q}`;
  };
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            {options.isAdmin && (
              <Link
                href="/meetings/groups"
                className={buttonClass("secondary")}
              >
                {t("groupSettings")}
              </Link>
            )}
            <Link href="/meetings/new" className={buttonClass()}>
              {t("schedule")}
            </Link>
          </div>
        }
      />
      <Card className="p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <Icon name="filter" className="h-4 w-4 text-[#df6d13]" />
              {t("filters")}
              {activeFilters > 0 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#b94f0a]">
                  {t("activeCount", { count: activeFilters })}
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="hidden text-xs text-[#8a8780] sm:inline">
                {t("filtersHint")}
              </span>
              <Icon
                name="chevronDown"
                className="h-4 w-4 text-[#6b6b6b] transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <form className="mt-5 grid gap-3 border-t border-black/5 pt-5 sm:grid-cols-3 lg:grid-cols-4">
            <input
              name="q"
              className="ui-input"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              defaultValue={query.get("q") || ""}
            />
            <select
              name="branchId"
              className="ui-input"
              aria-label={t("branchAria")}
              defaultValue={query.get("branchId") || ""}
            >
              <option value="">{t("allAccessibleBranches")}</option>
              {options.branches.map((b) => (
                <option value={b._id} key={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              name="groupId"
              className="ui-input"
              aria-label={t("groupAria")}
              defaultValue={query.get("groupId") || ""}
            >
              <option value="">{t("allGroups")}</option>
              {options.groups.map((g) => (
                <option value={g._id} key={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              className="ui-input"
              aria-label={t("statusAria")}
              defaultValue={query.get("status") || ""}
            >
              <option value="">{t("allStatuses")}</option>
              {MEETING_STATUSES.map((s) => (
                <option value={s} key={s}>
                  {tStatus(s)}
                </option>
              ))}
            </select>
            <select
              name="minutes"
              className="ui-input"
              aria-label={t("minutesAria")}
              defaultValue={query.get("minutes") || ""}
            >
              <option value="">{t("allMinutesStatuses")}</option>
              {MINUTES_STATUSES.map((s) => (
                <option value={s} key={s}>
                  {tMinutes(s)}
                </option>
              ))}
            </select>
            <select
              name="sort"
              className="ui-input"
              aria-label={t("sortAria")}
              defaultValue={query.get("sort") || "newest"}
            >
              <option value="newest">{t("latestFirst")}</option>
              <option value="oldest">{t("earliestFirst")}</option>
            </select>
            <label className="text-sm">
              {t("fromUtc")}
              <input
                name="from"
                type="date"
                className="ui-input"
                defaultValue={query.get("from") || ""}
              />
            </label>
            <label className="text-sm">
              {t("toUtc")}
              <input
                name="to"
                type="date"
                className="ui-input"
                defaultValue={query.get("to") || ""}
              />
            </label>
            <select
              className="ui-input"
              name="actions"
              aria-label={t("actionsAria")}
              defaultValue={query.get("actions") || ""}
            >
              <option value="">{t("allActions")}</option>
              <option value="due">{t("myOverdueActions")}</option>
            </select>
            <select
              className="ui-input"
              name="upcoming"
              aria-label={t("upcomingAria")}
              defaultValue={query.get("upcoming") || ""}
            >
              <option value="">{t("allDates")}</option>
              <option value="true">{t("next24Hours")}</option>
            </select>
            <button className={buttonClass()}>{t("applyFilters")}</button>
            <Link className={buttonClass("secondary")} href="/meetings">
              {t("clearFilters")}
            </Link>
          </form>
        </details>
      </Card>
      <Card className="p-5 overflow-x-auto">
        <p className="mb-4 text-sm">{t("total", { count: result.total })}</p>
        <table className="ui-table w-full">
          <thead>
            <tr>
              <th>{t("headers.meeting")}</th>
              <th>{t("headers.branchGroup")}</th>
              <th>{t("headers.starts")}</th>
              <th>{t("headers.status")}</th>
              <th>{t("headers.minutes")}</th>
              <th>{t("headers.actions")}</th>
              <th>
                <span className="sr-only">{t("headers.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((m) => (
              <tr key={m._id}>
                <td>
                  <Link
                    className="font-medium underline"
                    href={`/meetings/${m._id}`}
                  >
                    {m.title}
                  </Link>
                </td>
                <td>
                  {typeof m.branchId === "object" ? m.branchId.name : ""}
                  <br />
                  {typeof m.groupId === "object" ? m.groupId.name : ""}
                </td>
                <td>
                  {t("startsUtc", {
                    date: format.dateTime(new Date(m.startsAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }),
                  })}
                </td>
                <td>{statusLabel(m.status)}</td>
                <td className={m.minutesOverdue ? "text-red-700" : ""}>
                  {m.minutesOverdue ? t("overduePrefix") : ""}
                  {minutesLabel(m.minutesStatus)}
                </td>
                <td>
                  {t("openCount", {
                    count: m.actions.filter((a) => a.status === "open").length,
                  })}
                </td>
                <td className="text-right">
                  <Link
                    href={`/meetings/${m._id}`}
                    aria-label={t("openMeetingAria", { title: m.title })}
                    title={t("openTitle", { title: m.title })}
                    className={buttonClass(
                      "secondary",
                      "sm",
                      "h-9 w-9 px-0 text-[#b94f0a] hover:bg-orange-50",
                    )}
                  >
                    <Icon name="arrowUpRight" className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.items.length && (
          <p className="py-8 text-center text-[#6b6b6b]">{t("empty")}</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <span>
            {t("pageOf", {
              page: result.page,
              total: Math.max(1, Math.ceil(result.total / result.limit)),
            })}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={pageLink(result.page - 1)}
                className={buttonClass("secondary", "sm")}
              >
                {t("previous")}
              </Link>
            )}
            {result.page * result.limit < result.total && (
              <Link
                href={pageLink(result.page + 1)}
                className={buttonClass("secondary", "sm")}
              >
                {t("next")}
              </Link>
            )}
          </div>
        </div>
      </Card>
    </Shell>
  );
}
