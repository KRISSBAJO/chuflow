"use client";
import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Badge, Button, Card, CardHeader, TableWrap } from "@/components/ui/ui";
import type { BranchSummary, WeeklyReportItem } from "@/lib/types";
type Church = Pick<
  BranchSummary,
  "_id" | "name" | "district" | "oversightRegion"
> & { zoneId?: string; areaId?: string; zoneName?: string; areaName?: string };
export function ReportComparison({
  branches,
  items,
}: {
  branches: Church[];
  items: WeeklyReportItem[];
}) {
  const t = useTranslations("workspace");
  const tc = useTranslations("common");
  const f = useFormatter();
  const [trail, setTrail] = useState<{ label: string; ids: string[] }[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const level = trail.length;
  const keys = [
    "oversightRegion",
    "district",
    "zoneId",
    "areaId",
    "_id",
  ] as const;
  const levels = [
    tc("nationalArea"),
    tc("district"),
    t("zone"),
    t("area"),
    t("church"),
  ];
  const scoped = trail.length
    ? branches.filter((b) => trail[trail.length - 1].ids.includes(b._id))
    : branches;
  const groups = new Map<string, { label: string; ids: string[] }>();
  for (const b of scoped) {
    const key = b[keys[level]] || "unplaced";
    const label =
      level === 4
        ? b.name
        : level === 2
          ? b.zoneName
          : level === 3
            ? b.areaName
            : b[keys[level]];
    const group = groups.get(key) || {
      label: label || t("directChurches"),
      ids: [],
    };
    group.ids.push(b._id);
    groups.set(key, group);
  }
  const rows = Array.from(groups.entries())
    .map(([key, g]) => {
      const reports = items.filter((i) => g.ids.includes(i.branch._id));
      return {
        key,
        ...g,
        reports: reports.length,
        attendance: reports.reduce((n, i) => n + i.currentAttendance, 0),
        growth: reports.reduce((n, i) => n + i.growth, 0),
        reporting: new Set(reports.map((i) => i.branch._id)).size,
      };
    })
    .filter((g) => g.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages);
  return (
    <Card className="p-6">
      <CardHeader title={t("comparison")} description={t("noReportHint")} />
      <nav
        aria-label={t("scope")}
        className="my-5 flex flex-wrap items-center gap-2 text-sm"
      >
        <button
          className="text-orange-700"
          onClick={() => {
            setTrail([]);
            setPage(1);
            setSearch("");
          }}
        >
          {t("all")}
        </button>
        {trail.map((node, index) => (
          <span key={index}>
            {" "}
            /{" "}
            <button
              className="text-orange-700"
              onClick={() => {
                setTrail(trail.slice(0, index + 1));
                setPage(1);
                setSearch("");
              }}
            >
              {node.label}
            </button>
          </span>
        ))}
      </nav>
      <div className="mb-5 flex flex-wrap gap-3">
        <Badge tone="flame">{levels[level]}</Badge>
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          className="ui-input max-w-sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <TableWrap>
        <table className="ui-table">
          <thead>
            <tr>
              <th>{levels[level]}</th>
              <th>{t("reportProgress")}</th>
              <th>{t("submissions")}</th>
              <th>{t("attendance")}</th>
              <th>{t("growthColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 25, current * 25).map((g) => (
              <tr key={g.key}>
                <td>
                  {level < 4 ? (
                    <button
                      className="font-medium text-orange-700"
                      onClick={() => {
                        setTrail([...trail, { label: g.label, ids: g.ids }]);
                        setPage(1);
                        setSearch("");
                      }}
                    >
                      {g.label} ↗
                    </button>
                  ) : (
                    g.label
                  )}
                </td>
                <td>
                  {g.reporting} / {g.ids.length}
                </td>
                <td>
                  {g.reports || (
                    <span className="text-xs text-[#8a8780]">
                      {t("missing")}
                    </span>
                  )}
                </td>
                <td>{g.reports ? f.number(g.attendance) : "—"}</td>
                <td>{g.reports ? f.number(g.growth) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          {t("previous")}
        </Button>
        <span className="text-xs">
          {t("page", { page: current, total: pages })}
        </span>
        <Button
          variant="secondary"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </Card>
  );
}
