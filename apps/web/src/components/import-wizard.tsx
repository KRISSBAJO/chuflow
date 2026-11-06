"use client";
import Link from "next/link";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL, apiGet, apiPost } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  TableWrap,
  buttonClass,
} from "@/components/ui/ui";
import {
  IMPORT_CONFIG,
  importFieldLabel,
  matchImportColumns,
  type ImportKind,
} from "@/lib/import-fields";
import type { ParsedImportSheet } from "@/lib/import-parser";
import type { ImportView, ImportHistory } from "@/lib/import-types";
export function ImportWizard({
  branches,
  defaultBranchId,
  initialKind,
  initial,
  history,
}: {
  branches: { _id: string; name: string }[];
  defaultBranchId?: string;
  initialKind: ImportKind;
  initial?: ImportView;
  history: ImportHistory[];
}) {
  const t = useTranslations("imports");
  const [kind, setKind] = useState<ImportKind>(
    initial?.job.kind || initialKind,
  );
  const [branch, setBranch] = useState(
    initial?.job.branchId || defaultBranchId || branches[0]?._id || "",
  );
  const [sheets, setSheets] = useState<ParsedImportSheet[]>([]);
  const [sheet, setSheet] = useState(0);
  const [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dateFormat, setDateFormat] = useState("iso");
  const [view, setView] = useState<ImportView | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [ack, setAck] = useState(false);
  const [filter, setFilter] = useState("");
  const requestKey = useRef("");
  const activeRows = sheets[sheet]?.rows || [];
  const headers = activeRows[header]?.cells || [];
  const data = useMemo(
    () => sheets[sheet]?.rows.slice(header + 1) || [],
    [sheets, sheet, header],
  );
  const fields = IMPORT_CONFIG[kind].fields;
  const preview = useMemo(
    () =>
      data.slice(0, 5).map((row) => ({
        sourceRow: row.sourceRow,
        values: Object.fromEntries(
          Object.entries(mapping)
            .filter(([, col]) => col !== "")
            .map(([field, col]) => [field, row.cells[Number(col)] || ""]),
        ),
      })),
    [data, mapping],
  );
  const resetAttempt = () => {
    requestKey.current = "";
    setAck(false);
  };
  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSheets([]);
    setMapping({});
    resetAttempt();
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error(t("fileLimit"));
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/imports/parse", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        sheets?: ParsedImportSheet[];
        message?: string;
      };
      if (!response.ok || !result.sheets?.length)
        throw new Error(result.message || t("readError"));
      setSheets(result.sheets);
      setSheet(0);
      setHeader(0);
      setMapping(matchImportColumns(result.sheets[0].rows[0].cells, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("readError"));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function review() {
    if (!branch || !data.length || data.length > 10000) {
      setError(t("chooseData"));
      return;
    }
    const columns = Object.values(mapping).filter((v) => v !== "");
    if (new Set(columns).size !== columns.length) {
      setError(t("oneColumn"));
      return;
    }
    if (
      kind !== "service_units" &&
      !mapping.fullName &&
      (!mapping.firstName || !mapping.lastName)
    ) {
      setError(t("nameMapping"));
      return;
    }
    if (kind === "guests" && !mapping.phone) {
      setError(t("phoneMapping"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const rows = data.map((row) => ({
        sourceRow: row.sourceRow,
        values: Object.fromEntries(
          Object.entries(mapping)
            .filter(([, col]) => col !== "")
            .map(([field, col]) => [
              field,
              (row.cells[Number(col)] || "").trim(),
            ]),
        ),
      }));
      const large = rows.find((r) => JSON.stringify(r.values).length > 6500);
      if (large)
        throw new Error(
          `Row ${large.sourceRow} is too long. Remove unnecessary columns or shorten long notes.`,
        );
      requestKey.current ||= crypto.randomUUID();
      const job = await apiPost<{ _id: string }>("/imports", {
        branchId: branch,
        kind,
        dateFormat,
        requestKey: requestKey.current,
        expectedRows: rows.length,
      });
      window.history.replaceState(null, "", `/imports?job=${job._id}`);
      let offset = 0;
      while (offset < rows.length) {
        const chunk: typeof rows = [];
        let bytes = 0;
        while (offset + chunk.length < rows.length && chunk.length < 100) {
          const row = rows[offset + chunk.length];
          const length =
            new TextEncoder().encode(JSON.stringify(row)).length + 2;
          if (chunk.length && bytes + length > 75000) break;
          chunk.push(row);
          bytes += length;
        }
        setProgress(
          `${t("uploading")} ${offset + chunk.length} / ${rows.length}`,
        );
        await apiPost(`/imports/${job._id}/rows`, { offset, rows: chunk });
        offset += chunk.length;
      }
      setProgress(t("validating"));
      setView(await apiPost<ImportView>(`/imports/${job._id}/validate`, {}));
      setFilter("");
      toast.success(t("reviewRows"), { id: "import-feedback" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("readError"));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function loadPage(page: number, status = filter) {
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      setView(
        await apiGet<ImportView>(
          `/imports/${view.job._id}?page=${page}&status=${status}`,
        ),
      );
      setFilter(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("readError"));
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    if (!view || busy) return;
    setBusy(true);
    setError("");
    try {
      let next = view;
      if (view.job.status === "ready")
        next = await apiPost<ImportView>(`/imports/${view.job._id}/commit`, {
          branchId: view.job.branchId,
          expectedValid: view.job.valid,
        });
      setView(next);
      while (next.job.status === "importing") {
        setProgress(
          `${t("importing")} ${next.counts.imported || 0} / ${next.job.valid}`,
        );
        next = await apiPost<ImportView>(`/imports/${next.job._id}/step`, {});
        setView(next);
      }
      if (next.job.status === "completed")
        toast.success(t("imported"), {
          id: "import-feedback",
          description: `${next.counts.imported || 0} ${t("recordsFound")}`,
        });
    } catch (e) {
      const message = e instanceof Error ? e.message : t("resumeHint");
      setError(message);
      toast.error(message, { id: "import-feedback" });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function downloadResults() {
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      setProgress(t("results"));
      const response = await fetch(
        `${API_URL}/imports/${view.job._id}/results.csv`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error(t("readError"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chuflow-import-${view.job._id}-results.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("readError"));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  const typeLabel = (k: ImportKind) => t(k);
  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {progress && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl bg-orange-50 p-4 text-sm text-orange-900"
        >
          {progress}
        </p>
      )}
      {!view ? (
        <>
          <Card className="p-6">
            <CardHeader
              label={t("stepOne")}
              title={t("chooseFile")}
              description={t("safeHint")}
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label={t("church")} required>
                <select
                  className="ui-input"
                  value={branch}
                  disabled={busy}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    resetAttempt();
                  }}
                >
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("recordType")}>
                <select
                  className="ui-input"
                  value={kind}
                  disabled={busy}
                  onChange={(e) => {
                    const k = e.target.value as ImportKind;
                    setKind(k);
                    setMapping(matchImportColumns(headers, k));
                    resetAttempt();
                  }}
                >
                  {Object.keys(IMPORT_CONFIG).map((k) => (
                    <option key={k} value={k}>
                      {typeLabel(k as ImportKind)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`/api/imports/template?kind=${kind}&format=xlsx`}
                className={buttonClass("secondary", "sm")}
              >
                {t("excelTemplate")}
              </a>
              <a
                href={`/api/imports/template?kind=${kind}&format=csv`}
                className={buttonClass("secondary", "sm")}
              >
                {t("csvTemplate")}
              </a>
            </div>
            <label className="mt-5 block rounded-2xl border-2 border-dashed border-orange-200 bg-white p-6 text-sm">
              <span className="mb-3 block font-medium">{t("fileLabel")}</span>
              <input
                type="file"
                accept=".xlsx,.csv,.tsv"
                disabled={busy}
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
              <span className="mt-3 block text-xs text-[#8a8780]">
                {t("fileLimit")}
              </span>
            </label>
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer font-medium">
                {t("googleSheets")}
              </summary>
              <p className="mt-3 text-[#6b6b6b]">{t("googleInstructions")}</p>
            </details>
          </Card>
          {!!sheets.length && (
            <Card className="p-6">
              <CardHeader
                label={t("stepTwo")}
                title={t("matchColumns")}
                description={`${data.length} ${t("recordsFound")}`}
              />
              <div className="my-5 grid gap-3 sm:grid-cols-3">
                <Field label={t("sheet")}>
                  <select
                    className="ui-input"
                    value={sheet}
                    disabled={busy}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setSheet(i);
                      setHeader(0);
                      setMapping(
                        matchImportColumns(sheets[i].rows[0].cells, kind),
                      );
                      resetAttempt();
                    }}
                  >
                    {sheets.map((s, i) => (
                      <option key={i} value={i}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("headerRow")}>
                  <select
                    className="ui-input"
                    value={header}
                    disabled={busy}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setHeader(n);
                      setMapping(matchImportColumns(activeRows[n].cells, kind));
                      resetAttempt();
                    }}
                  >
                    {activeRows.slice(0, 10).map((r, i) => (
                      <option key={r.sourceRow} value={i}>
                        {r.sourceRow}:{" "}
                        {r.cells.slice(0, 3).join(" · ").slice(0, 70)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("dateFormat")}>
                  <select
                    className="ui-input"
                    value={dateFormat}
                    disabled={busy}
                    onChange={(e) => {
                      setDateFormat(e.target.value);
                      resetAttempt();
                    }}
                  >
                    <option value="iso">YYYY-MM-DD</option>
                    <option value="mdy">MM/DD/YYYY</option>
                    <option value="dmy">DD/MM/YYYY</option>
                  </select>
                </Field>
              </div>
              <p className="mb-5 text-xs text-[#6b6b6b]">{t("mappingHint")}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => (
                  <Field key={field} label={importFieldLabel(field)}>
                    <select
                      className="ui-input"
                      value={mapping[field] ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        setMapping((m) => ({ ...m, [field]: e.target.value }));
                        resetAttempt();
                      }}
                    >
                      <option value="">{t("ignoreColumn")}</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`} ({i + 1})
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <details className="my-5 text-sm">
                <summary className="cursor-pointer font-medium">
                  {t("previewFive")}
                </summary>
                <div className="mt-3">
                  <TableWrap>
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>{t("sourceRow")}</th>
                          <th>{t("preview")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r) => (
                          <tr key={r.sourceRow}>
                            <td>{r.sourceRow}</td>
                            <td className="max-w-3xl whitespace-pre-wrap text-xs">
                              {Object.entries(r.values)
                                .map(([k, v]) => `${importFieldLabel(k)}: ${v}`)
                                .join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
              </details>
              <Button
                onClick={() => void review()}
                disabled={busy || !data.length}
              >
                {t("reviewRows")}
              </Button>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="p-6">
            <CardHeader
              label={typeLabel(view.job.kind)}
              title={
                branches.find((b) => b._id === view.job.branchId)?.name ||
                t("church")
              }
              action={
                <Badge
                  tone={view.job.status === "completed" ? "success" : "flame"}
                >
                  {view.job.status}
                </Badge>
              }
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t("ready"), view.counts.ready || 0],
                [t("imported"), view.counts.imported || 0],
                [t("duplicates"), view.counts.duplicate || 0],
                [
                  t("invalid"),
                  (view.counts.invalid || 0) + (view.counts.failed || 0),
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white p-4">
                  <p className="text-xs text-[#6b6b6b]">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-[#6b6b6b]">{t("reviewHint")}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {view.job.status === "ready" && !!view.counts.ready && (
                <>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ack}
                      disabled={busy}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    {t("confirmChurch")}
                  </label>
                  <Button disabled={busy || !ack} onClick={() => void run()}>
                    {t("importValid", { count: view.counts.ready })}
                  </Button>
                </>
              )}
              {view.job.status === "importing" && (
                <Button disabled={busy} onClick={() => void run()}>
                  {t("resume")}
                </Button>
              )}
              {view.job.status === "uploading" &&
                (view.counts.uploaded || 0) < view.job.expectedRows && (
                  <p className="text-sm text-[#6b6b6b]">{t("incomplete")}</p>
                )}
              {["uploading", "validating"].includes(view.job.status) && (
                <Button
                  disabled={
                    busy || (view.counts.uploaded || 0) < view.job.expectedRows
                  }
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setView(
                        await apiPost<ImportView>(
                          `/imports/${view.job._id}/validate`,
                          {},
                        ),
                      );
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t("readError"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("reviewRows")}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void downloadResults()}
              >
                {t("results")}
              </Button>
              <Link
                href={IMPORT_CONFIG[view.job.kind].path}
                className={buttonClass("secondary")}
              >
                {t("openDirectory")} ↗
              </Link>
              <a
                href={`/imports?kind=${view.job.kind}`}
                className="text-sm text-orange-700"
              >
                {t("startNew")}
              </a>
            </div>
            {view.job.status === "importing" && (
              <p className="mt-4 text-xs text-[#8a8780]">{t("resumeHint")}</p>
            )}
            <p className="mt-4 text-xs text-[#8a8780]">{t("retention")}</p>
          </Card>
          <Card className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{t("rowResults")}</h2>
              <select
                aria-label={t("rowResults")}
                className="ui-input max-w-xs"
                disabled={busy}
                value={filter}
                onChange={(e) => void loadPage(1, e.target.value)}
              >
                <option value="">{t("allRows")}</option>
                {["ready", "imported", "duplicate", "invalid"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{t("sourceRow")}</th>
                    <th>{t("status")}</th>
                    <th>{t("name")}</th>
                    <th>{t("contact")}</th>
                    <th>{t("reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r._id} className="align-top">
                      <td>{r.sourceRow}</td>
                      <td>
                        <Badge
                          tone={
                            r.status === "imported"
                              ? "success"
                              : r.status === "ready"
                                ? "info"
                                : "warning"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td>
                        {String(
                          r.normalized?.name ||
                            [r.normalized?.firstName, r.normalized?.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            r.values.fullName ||
                            r.values.name ||
                            [r.values.firstName, r.values.lastName]
                              .filter(Boolean)
                              .join(" "),
                        )}
                      </td>
                      <td>{r.values.email || r.values.phone || "—"}</td>
                      <td className="max-w-md text-sm text-[#6b6b6b]">
                        {r.reason || "—"}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-orange-700">
                            {t("mappedValues")}
                          </summary>
                          <dl className="mt-2 space-y-1 text-xs">
                            {Object.entries(r.values).map(([k, v]) => (
                              <div key={k}>
                                <dt className="font-medium">
                                  {importFieldLabel(k)}
                                </dt>
                                <dd className="whitespace-pre-wrap break-words">
                                  {v || "—"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="secondary"
                disabled={busy || view.pagination.page <= 1}
                onClick={() => void loadPage(view.pagination.page - 1)}
              >
                {t("previous")}
              </Button>
              <span className="text-xs">
                {view.pagination.page} / {view.pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={
                  busy || view.pagination.page >= view.pagination.totalPages
                }
                onClick={() => void loadPage(view.pagination.page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </Card>
        </>
      )}
      {!!history.length && (
        <Card className="p-6">
          <CardHeader title={t("history")} />
          <div className="mt-5 space-y-2">
            {history.map((h) => (
              <Link
                key={h._id}
                href={`/imports?job=${h._id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm"
              >
                <span>
                  {typeLabel(h.kind)} ·{" "}
                  {branches.find((b) => b._id === h.branchId)?.name ||
                    t("church")}{" "}
                  · {h.expectedRows}
                </span>
                <Badge>{h.status}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
