"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button, Field } from "@/components/ui/ui";
import { FilterPanel } from "@/components/filter-panel";
import type { BranchSummary } from "@/lib/types";

import { weeklyFigureError, weeklyFigureFlags, weeklyFigureNumber, WSF_AVERAGE } from "../../../../packages/types/src/weekly-report-figures";

const FIELDS = [
  "currentAttendance",
  "firstTimersCount",
  "newConvertsCount",
  "believersFoundationClassCount",
  "holySpiritBaptismCount",
  "waterBaptismCount",
  "covenantHourOfPrayerAttendance",
  "winnersSatelliteFellowshipAverage",
  "cellCount",
  "newCellCount",
  "wofbiAttendance",
];
type Report = {
  _id: string;
  status: string;
  workflowRevision?: number;
  submittedBy?: string;
  remarks?: string;
  [key: string]: unknown;
};
type Row = { branch: BranchSummary; report: Report | null };
type Matrix = {
  weekEnding: string;
  canReview: boolean;
  rows: Row[];
  totals: Record<string, number | null>;
  coverage: {
    total: number;
    acknowledged: number;
    missing: number;
    pending: number;
  };
};
type Packet = {
  _id: string;
  status: string;
  recipientId: string;
  weekEnding: string;
  district: string;
  reviewNote?: string;
  snapshot: Matrix;
};
export function WeeklyReportWorkspace({
  branches,
  defaultBranchId,
  userId,
  form = false,
  reportId,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
  userId: string;
  form?: boolean;
  reportId?: string;
}) {
  const messages = useTranslations("services.weeklyReports.workflow");
  const t = (key: string) => messages(key as Parameters<typeof messages>[0]);
  const f = useFormatter();
  const router = useRouter();
  const q = useSearchParams();
  const [week, setWeek] = useState(
    q.get("week") || new Date().toISOString().slice(0, 10),
  );
  const [branch, setBranch] = useState(
    q.get("branchId") || defaultBranchId || branches[0]?._id || "",
  );
  const [district, setDistrict] = useState("");
  const [matrix, setMatrix] = useState<Matrix>();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [figures, setFigures] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [step, setStep] = useState(1);
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [recipients, setRecipients] = useState<{ _id: string; name: string }[]>(
    [],
  );
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState("");
  const selected = branches.find((b) => b._id === branch);
  const districtBranch = branches.find(
    (b) => `${b.oversightRegion}|${b.district}` === district,
  );
  const current = reportId
    ? matrix?.rows.find((r) => r.report?._id === reportId)?.report
    : undefined;
  const locked = current?.status === "approved";
  useEffect(() => {
    let alive = true;
    setMatrix(undefined);
    setError("");
    apiGet<Matrix>(`/weekly-reports?weekEnding=${encodeURIComponent(week)}`)
      .then((data) => {
        if (alive) setMatrix(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [week]);
  useEffect(() => {
    if (!current) return;
    setFigures(
      Object.fromEntries(
        FIELDS.map((key) => [
          key,
          current[key] === undefined ? "" : String(current[key]),
        ]),
      ),
    );
    setRemarks(current.remarks || "");
  }, [current]);
  useEffect(() => {
    if (!branch) return;
    let alive = true;
    setBaseline({});
    apiGet<Record<string, number>>(
      `/weekly-reports/defaults?branchId=${branch}&weekEnding=${encodeURIComponent(week)}`,
    )
      .then((data) => {
        if (alive) setBaseline(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [branch, week]);
  useEffect(() => {
    let alive = true;
    setRecipients([]);
    setRecipient("");
    if (districtBranch)
      apiGet<{ _id: string; name: string }[]>(
        `/weekly-reports/recipients?district=${encodeURIComponent(districtBranch.district || "")}&oversightRegion=${encodeURIComponent(districtBranch.oversightRegion || "")}`,
      )
        .then((data) => {
          if (alive) setRecipients(data);
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [districtBranch]);
  useEffect(() => {
    apiGet<Packet[]>("/weekly-reports/packets")
      .then(setPackets)
      .catch(() => {});
  }, []);
  async function action(run: () => Promise<unknown>, redirect = false) {
    setBusy(true);
    try {
      await run();
      toast.success(t("saved"));
      if (redirect) router.push("/weekly-reports/workspace?week=" + week);
      else {
        setMatrix(
          await apiGet<Matrix>(
            `/weekly-reports?weekEnding=${encodeURIComponent(week)}`,
          ),
        );
        setPackets(await apiGet<Packet[]>("/weekly-reports/packets"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (key: string) => weeklyFigureError(key, figures[key] ?? '', figures.currentAttendance ?? '');
  const hasFigureErrors = FIELDS.some((key) => fieldError(key));
  const values = Object.fromEntries(FIELDS.filter((key) => figures[key]).map((key) => [key, weeklyFigureNumber(figures[key])]));
  const flags = locked && current
    ? weeklyFigureFlags(current, current.previousAttendance, FIELDS)
    : weeklyFigureFlags(values, baseline.previousAttendance, FIELDS).filter(({ key }) => !fieldError(key));

  function save(submit: boolean) {
    if (hasFigureErrors) return;
    if (submit && FIELDS.some((key) => !figures[key])) {
      toast.error(t('completeFigures'));
      setStep(1);
      return;
    }
    void action(
      () =>
        reportId
          ? apiPatch(`/weekly-reports/${reportId}`, {
              branchId: branch,
              weekEnding: week,
              figures: values,
              remarks,
              submit,
              revision: current?.workflowRevision ?? 0,
            })
          : apiPost("/weekly-reports", {
              branchId: branch,
              weekEnding: week,
              figures: values,
              remarks,
              submit,
            }),
      true,
    );
  }
  const number = (value: unknown) =>
    typeof value === "number"
      ? f.number(value, { maximumFractionDigits: 2 })
      : "—";
  function table(data: Matrix) {
    return (
      <div className="overflow-x-auto">
        <table className="ui-table min-w-[1400px]">
          <thead>
            <tr>
              <th>{t("branch")}</th>
              <th>{t("review")}</th>
              {[
                ...FIELDS,
                "previousAttendance",
                "growth",
                "growthPercent",
                "averageLastYear",
                "averageLastPeriod",
              ].map((key) => (
                <th key={key}>
                  {t(FIELDS.includes(key) ? `fields.${key}` : key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.branch._id}>
                <td>{row.branch.name}</td>
                <td>{row.report ? t(row.report.status) : t("missing")}</td>
                {[
                  ...FIELDS,
                  "previousAttendance",
                  "growth",
                  "growthPercent",
                  "averageLastYear",
                  "averageLastPeriod",
                ].map((key) => (
                  <td key={key}>{number(row.report?.[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link
          className="ui-button"
          href={
            form
              ? "/weekly-reports/workspace"
              : "/weekly-reports/new?week=" + week
          }
        >
          {t(form ? "back" : "new")}
        </Link>
      </div>
      <p className="text-sm text-[#6b6b6b]">{t("summaryHint")}</p>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("week")}>
          <input
            className="ui-input"
            type="date"
            value={week}
            disabled={!!reportId || busy}
            onChange={(e) => setWeek(e.target.value)}
          />
        </Field>
        {form && (
          <Field label={t("branch")}>
            <select
              className="ui-input"
              disabled={!!reportId || busy}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {form ? (
        <div className="app-card space-y-5 p-5">
          {locked && <p>{t("locked")}</p>}
          {step === 1 && !locked ? (
            <>
              <h2>{t("firstStep")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((key) => (
                  <Field key={key} label={t(`fields.${key}`)}>
                    <input
                      className="ui-input"
                      type="text"
                      inputMode={key === WSF_AVERAGE ? "decimal" : "numeric"}
                      aria-invalid={!!fieldError(key)}
                      aria-describedby={fieldError(key) ? `weekly-error-${key}` : undefined}
                      value={figures[key] ?? ""}
                      onChange={(e) =>
                        setFigures({ ...figures, [key]: e.target.value })
                      }
                    />
                    {fieldError(key) && (
                      <span id={`weekly-error-${key}`} className="text-sm text-red-700">
                        {t(`validation.${fieldError(key)}`)}
                      </span>
                    )}
                  </Field>
                ))}
              </div>
              <Field label={t("remarks")}>
                <textarea
                  className="ui-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </Field>
              <Button disabled={hasFigureErrors} onClick={() => setStep(2)}>{t("next")}</Button>
            </>
          ) : (
            <>
              <h2>{t("next")}</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((key) => (
                  <div key={key}>
                    <dt>{t(`fields.${key}`)}</dt>
                    <dd>
                      {number(
                        locked
                          ? current?.[key]
                          : figures[key] !== undefined && figures[key] !== ""
                            ? weeklyFigureNumber(figures[key])
                            : undefined,
                      )}
                    </dd>
                  </div>
                ))}
                {[
                  "previousAttendance",
                  "averageLastYear",
                  "averageLastPeriod",
                ].map((key) => (
                  <div key={key}>
                    <dt>{t(key)}</dt>
                    <dd>{number(locked ? current?.[key] : baseline[key])}</dd>
                  </div>
                ))}
              </dl>
              {!locked && (
                <Button variant="secondary" onClick={() => setStep(1)}>
                  {t("firstStep")}
                </Button>
              )}
            </>
          )}
          {flags.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              {flags.map(({ key, message }) => (
                <li key={`${key}-${message}`}>{t(`fields.${key}`)} · {t(`validation.${message}`)}</li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="flex gap-3">
              <Button
                disabled={busy || hasFigureErrors || !matrix || (!!reportId && !current)}
                variant="secondary"
                onClick={() => save(false)}
              >
                {t("save")}
              </Button>
              {step === 2 && (
                <Button
                  disabled={busy || hasFigureErrors || !matrix || (!!reportId && !current)}
                  onClick={() => save(true)}
                >
                  {t("submit")}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        matrix && (
          <>
            <div className="app-card p-4">
              {t("coverage")}: {matrix.coverage.acknowledged} /{" "}
              {matrix.coverage.total}
            </div>
            {table(matrix)}
            <div className="app-card flex flex-wrap gap-5 p-4">
              <strong>{t("totals")}</strong>
              {[
                "currentAttendance",
                "previousAttendance",
                "growth",
                "growthPercent",
              ].map((key) => (
                <span key={key}>
                  {t(key === "currentAttendance" ? `fields.${key}` : key)}:{" "}
                  {number(matrix.totals[key])}
                </span>
              ))}
            </div>
            <div className="space-y-2">
              {matrix.rows
                .filter((row) => row.report)
                .map((row) => (
                  <div
                    key={row.branch._id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                  >
                    <span className="mr-auto">
                      {row.branch.name} · {t(row.report!.status)}
                    </span>
                    <Link
                      href={`/weekly-reports/manage/${row.report!._id}?week=${week}&branchId=${row.branch._id}`}
                    >
                      {t("open")}
                    </Link>
                    {weeklyFigureFlags(row.report!, row.report!.previousAttendance, FIELDS).map(({ key, message }) => (
                      <p key={`${key}-${message}`} className="basis-full text-sm text-amber-800">
                        {t(`fields.${key}`)} · {t(`validation.${message}`)}
                      </p>
                    ))}
                    {matrix.canReview &&
                      row.report?.status === "pending" &&
                      row.report.submittedBy !== userId && (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void action(() =>
                                apiPatch(
                                  `/weekly-reports/${row.report!._id}/review`,
                                  {
                                    revision: row.report!.workflowRevision ?? 0,
                                    decision: "approved",
                                  },
                                ),
                              )
                            }
                          >
                            {t("acknowledge")}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void action(() =>
                                apiPatch(
                                  `/weekly-reports/${row.report!._id}/review`,
                                  {
                                    revision: row.report!.workflowRevision ?? 0,
                                    decision: "rejected",
                                  },
                                ),
                              )
                            }
                          >
                            {t("return")}
                          </Button>
                        </>
                      )}
                  </div>
                ))}
            </div>
            {matrix.canReview && (
              <FilterPanel title={t("forward")}>
                <div className="space-y-3">
                  <select
                    aria-label={t("district")}
                    className="ui-input"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="">{t("selectDistrict")}</option>
                    {[
                      ...new Set(
                        branches.map(
                          (b) => `${b.oversightRegion}|${b.district}`,
                        ),
                      ),
                    ].map((key) => (
                      <option key={key} value={key}>
                        {key.replace("|", " · ")}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t("recipient")}
                    className="ui-input"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    <option value="">{t("recipient")}</option>
                    {recipients.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || !recipient || !districtBranch}
                    onClick={() =>
                      void action(() =>
                        apiPost("/weekly-reports/packets", {
                          district: districtBranch!.district,
                          oversightRegion: districtBranch!.oversightRegion,
                          weekEnding: week,
                          recipientId: recipient,
                        }),
                      )
                    }
                  >
                    {t("forward")}
                  </Button>
                </div>
              </FilterPanel>
            )}
            <h2 className="font-semibold">{t("packets")}</h2>
            {packets.map((packet) => (
              <div className="app-card space-y-3 p-4" key={packet._id}>
                <button
                  onClick={() =>
                    setExpanded(expanded === packet._id ? "" : packet._id)
                  }
                >
                  {packet.district} · {packet.weekEnding.slice(0, 10)} ·{" "}
                  {t(packet.status)} ▾
                </button>
                {expanded === packet._id && (
                  <>
                    <p>{t("snapshot")}</p>
                    {table(packet.snapshot)}
                    {packet.reviewNote && <p>{packet.reviewNote}</p>}
                    {packet.recipientId === userId &&
                      packet.status === "submitted" && (
                        <>
                          <textarea
                            aria-label={t("reviewNote")}
                            className="ui-input"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          {(["acknowledged", "returned"] as const).map(
                            (decision) => (
                              <Button
                                key={decision}
                                disabled={busy}
                                onClick={() =>
                                  void action(() =>
                                    apiPatch(
                                      `/weekly-reports/packets/${packet._id}`,
                                      { decision, note },
                                    ),
                                  )
                                }
                              >
                                {t(
                                  decision === "acknowledged"
                                    ? "acknowledge"
                                    : "return",
                                )}
                              </Button>
                            ),
                          )}
                        </>
                      )}
                  </>
                )}
              </div>
            ))}
          </>
        )
      )}
      {form && selected && (
        <p className="text-xs text-[#6b6b6b]">{selected.name}</p>
      )}
    </div>
  );
}
