"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAppFormat } from "@/i18n/labels";
import { FilterPanel } from "@/components/filter-panel";
import { ExportMenu } from "@/components/export-menu";
import { Badge, Button, EmptyState, TableWrap } from "@/components/ui/ui";
import { detailHref } from "@/lib/workspace-navigation";
import type {
  AttendanceItem,
  BranchSummary,
  ServiceTypeSummary,
  ServiceScheduleSummary,
} from "@/lib/types";
function branchId(r: AttendanceItem) {
  return typeof r.branchId === "string" ? r.branchId : r.branchId?._id;
}
export function AttendanceSummaryTable({
  records,
  branches,
  serviceTypes,
  defaultBranchId,
}: {
  records: AttendanceItem[];
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
  canEdit?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("services.attendance.summaries");
  const tw = useTranslations("workspace");
  const { dateTime } = useAppFormat();
  const q = useSearchParams();
  const [search, setSearch] = useState(q.get("search") || "");
  const [branch, setBranch] = useState(
    q.get("branchId") || defaultBranchId || "",
  );
  const [service, setService] = useState(q.get("serviceType") || "");
  const [sort, setSort] = useState(q.get("sort") || "newest");
  const [page, setPage] = useState(Math.max(1, Number(q.get("page")) || 1));
  const [pageSize, setPageSize] = useState(
    [25, 50, 100].includes(Number(q.get("pageSize")))
      ? Number(q.get("pageSize"))
      : 25,
  );
  const [breakdown, setBreakdown] = useState(false);
  const [month, setMonth] = useState(q.get("month")||"");
  const [year, setYear] = useState(q.get("year")||"");
  const [weekday, setWeekday] = useState(q.get("weekday")||"all");
  const [from, setFrom] = useState(q.get("filterFrom")||"");
  const [to, setTo] = useState(q.get("filterTo")||"");
  const total = (r: AttendanceItem) =>
    (r.adultsCount ?? (r.menCount ?? 0) + (r.womenCount ?? 0)) +
    (r.childrenCount ?? 0);

  const filtered = useMemo(
    () =>
      records
        .filter(
          (r) =>
            (!branch || branchId(r) === branch) &&
            (!month || r.serviceDate.slice(5, 7) === month) &&
            (!year || r.serviceDate.slice(0, 4) === year) &&
            (!from || r.serviceDate.slice(0, 10) >= from) &&
            (!to || r.serviceDate.slice(0, 10) <= to) &&
            (weekday === "all" ||
              new Date(
                r.serviceDate.slice(0, 10) + "T12:00:00Z",
              ).getUTCDay() === Number(weekday)) &&
            (!service ||
              r.serviceType === service ||
              r.serviceTypeId?._id === service) &&
            `${r.serviceName || ""} ${r.serviceTypeLabel || ""} ${r.serviceType}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "highest"
            ? total(b) - total(a)
            : sort === "lowest"
              ? total(a) - total(b)
              : (sort === "oldest" ? 1 : -1) *
                a.serviceDate.localeCompare(b.serviceDate),
        ),
    [records, branch, service, search, sort, month, year, weekday, from, to],
  );
  const sundays = filtered.filter(
    (r) =>
      new Date(r.serviceDate.slice(0, 10) + "T12:00:00Z").getUTCDay() === 0,
  );
  const sundayCount = new Set(sundays.map((r) => r.serviceDate.slice(0, 10)))
    .size;
  const average = filtered.length
    ? filtered.reduce((sum, r) => sum + total(r), 0) / filtered.length
    : undefined;
  const sundayAverage = sundayCount
    ? sundays.reduce((sum, r) => sum + total(r), 0) / sundayCount
    : undefined;
  const years = [...new Set(records.map((r) => r.serviceDate.slice(0, 4)))]
    .sort()
    .reverse();
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const params = {
    ...Object.fromEntries(q.entries()),
    tab: "summaries",
    month,year,weekday,filterFrom:from,filterTo:to,
    search,
    branchId: branch,
    serviceType: service,
    sort,
    page: String(current),
    pageSize: String(pageSize),
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label={t("searchAria")}
          placeholder={t("searchPlaceholder")}
          className="ui-input max-w-md"
        />
        <ExportMenu resource="attendance" rows={filtered} />
      </div>
      <FilterPanel>
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            {t("advanced.month")}
            <select
              className="ui-input"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
            >
              <option value="">—</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1).padStart(2, "0")}>
                  {new Intl.DateTimeFormat(locale, { month: "long" }).format(
                    new Date(2026, i, 1),
                  )}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("advanced.year")}
            <select
              className="ui-input"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
            >
              <option value="">—</option>
              {years.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {t("advanced.weekday")}
            <select
              className="ui-input"
              value={weekday}
              onChange={(e) => {
                setWeekday(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("advanced.allDays")}</option>
              {Array.from({ length: 7 }, (_, day) => (
                <option key={day} value={String(day)}>
                  {new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
                    new Date(2026, 10, 1 + day),
                  )}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("advanced.from")}
            <input
              className="ui-input"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            {t("advanced.to")}
            <input
              className="ui-input"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={branch}
            aria-label={t("branchAria")}
            onChange={(e) => {
              setBranch(e.target.value);
              setPage(1);
            }}
            className="ui-input"
          >
            <option value="">{t("allBranches")}</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={service}
            aria-label={t("serviceTypeAria")}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
            className="ui-input"
          >
            <option value="">{t("allServiceTypes")}</option>
            {serviceTypes.map((s) => (
              <option key={s._id} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            aria-label={t("sort")}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="ui-input"
          >
            <option value="newest">{t("newestFirst")}</option>
            <option value="oldest">{t("oldestFirst")}</option>
            <option value="highest">{t("advanced.highest")}</option>
            <option value="lowest">{t("advanced.lowest")}</option>
          </select>
          <select
            value={pageSize}
            aria-label={t("perPage")}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="ui-input"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setSearch("");
            setMonth("");
            setYear("");
            setWeekday("all");
            setFrom("");
            setTo("");
            setBranch(defaultBranchId || "");
            setService("");
            setSort("newest");
            setPage(1);
          }}
        >
          {t("resetFilters")}
        </Button>
      </FilterPanel>
      <div className="rounded-2xl bg-[#f5f4f1] p-4 text-sm">
        <div className="flex flex-wrap gap-6">
          <span>
            {t("advanced.average")}:{" "}
            <strong>
              {average === undefined
                ? "—"
                : average.toLocaleString(locale, { maximumFractionDigits: 1 })}
            </strong>
          </span>
          <span>
            {t("advanced.sundayAverage")}:{" "}
            <strong>
              {sundayAverage === undefined
                ? "—"
                : sundayAverage.toLocaleString(locale, {
                    maximumFractionDigits: 1,
                  })}
            </strong>
          </span>
          <span>
            {t("advanced.sundayCount")}: {sundayCount}
          </span>
        </div>
        <p className="mt-2 text-xs text-[#6b6b6b]">
          {t("advanced.averageHint")}
        </p>
      </div>
      <details className="text-sm text-[#6b6b6b]">
        <summary className="w-fit cursor-pointer">{tw("columns")}</summary>
        <label className="mt-3 flex gap-2">
          <input
            type="checkbox"
            checked={breakdown}
            onChange={(e) => setBreakdown(e.target.checked)}
          />
          {t("columns.men")} / {t("columns.women")} / {t("columns.holySpirit")}
        </label>
      </details>
      {!filtered.length ? (
        <EmptyState icon="attendance" title={t("emptyTitle")}>
          {t("emptyBody")}
        </EmptyState>
      ) : (
        <TableWrap>
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("branch")}</th>
                <th>{t("service")}</th>
                {["adults", "children", "firstTimers", "newConverts"].map(
                  (k) => (
                    <th key={k}>
                      {t(`columns.${k}` as Parameters<typeof t>[0])}
                    </th>
                  ),
                )}
                {breakdown && (
                  <>
                    <th>{t("columns.men")}</th>
                    <th>{t("columns.women")}</th>
                    <th>{t("columns.holySpirit")}</th>
                  </>
                )}
                <th>{tw("open")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice((current - 1) * pageSize, current * pageSize)
                .map((r) => (
                  <tr
                    key={r._id}
                    id={`record-${r._id}`}
                    className="scroll-mt-24"
                  >
                    <td className="whitespace-nowrap">
                      {dateTime(r.serviceDate)}
                    </td>
                    <td>
                      {typeof r.branchId === "object"
                        ? r.branchId?.name
                        : branches.find((b) => b._id === r.branchId)?.name}
                    </td>
                    <td>
                      <Link
                        href={detailHref("/attendance", r._id, params)}
                        className="font-medium hover:text-orange-700"
                      >
                        {r.serviceName || r.serviceTypeLabel || r.serviceType}
                      </Link>
                    </td>
                    <td>{r.adultsCount || 0}</td>
                    <td>{r.childrenCount || 0}</td>
                    <td>{r.firstTimersCount || 0}</td>
                    <td>{r.newConvertsCount || 0}</td>
                    {breakdown && (
                      <>
                        <td>{r.menCount || 0}</td>
                        <td>{r.womenCount || 0}</td>
                        <td>{r.holySpiritBaptismCount || 0}</td>
                      </>
                    )}
                    <td>
                      <Link
                        className="whitespace-nowrap text-orange-700"
                        href={detailHref("/attendance", r._id, params)}
                      >
                        {tw("open")} ↗
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge>{filtered.length}</Badge>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-xs">
            {tw("page", { page: current, total: pages })}
          </span>
          <Button
            variant="secondary"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
