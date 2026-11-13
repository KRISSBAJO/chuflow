"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Field } from "@/components/ui/ui";
import { apiPost } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";
import { AssetLabels } from "./asset-labels";
import { AssetCategoryPicker } from "./asset-category-picker";

const columns = ["tag", "name", "category", "location", "serial"] as const;
type Column = typeof columns[number];
const limits = { tag: 64, name: 120, category: 80, location: 120, serial: 100 };
type AssetInput = Record<Column, string>;
type Row = { sourceRow: number; values: AssetInput };
type Sheet = { name: string; rows: { sourceRow: number; cells: string[] }[] };
type Result = { row: number; tag: string; assetId?: string; status: "created" | "duplicate" };

export function AssetIntake({ mode, branches, defaultBranchId }: {
  mode: "register" | "import"; branches: BranchSummary[]; defaultBranchId?: string;
}) {
  const t = useTranslations("common.assetIntake");
  const a = useTranslations("admin.assets");
  const common = useTranslations("common");
  const [branchId, setBranchId] = useState(defaultBranchId ?? (branches.length === 1 ? branches[0]._id : ""));
  const [quantity, setQuantity] = useState(1);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<Column, number>>>({});
  const [results, setResults] = useState<{ sourceRow: number; tag: string; assetId?: string; name: string; invalid?: boolean }[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const sheet = sheets[sheetIndex];
  const preview = sheet?.rows.slice(1).map((row): Row => ({
    sourceRow: row.sourceRow,
    values: Object.fromEntries(columns.map((key) => [key, row.cells[mapping[key] ?? -1]?.trim() ?? ""])) as AssetInput,
  })) ?? [];
  const seen = new Set<string>();
  const duplicateRows = new Set<number>();
  const ready = preview.filter(({ sourceRow, values }) => {
    if (!values.name || !values.category || !columns.every((key) => values[key].length <= limits[key])) return false;
    const tag = values.tag.toUpperCase();
    if (tag && seen.has(tag)) {
      duplicateRows.add(sourceRow);
      return false;
    }
    if (tag) seen.add(tag);
    return true;
  });
  const readyIds = new Set(ready.map(({ sourceRow }) => sourceRow));

  function selectSheet(all: Sheet[], index: number) {
    setSheetIndex(index);
    const headers = all[index]?.rows[0]?.cells ?? [];
    setMapping(Object.fromEntries(columns.map((key) => [key, headers.findIndex((cell) => {
      const normalized = cell.toLowerCase().replace(/[^a-z]/g, "");
      return [key, { tag: "assettag", name: "itemname", category: "assetcategory", location: "storagelocation", serial: "serialnumber" }[key]].includes(normalized);
    })])));
  }

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResults(undefined);
    setSheets([]);
    try {
      const response = await fetch("/api/assets/parse", { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) throw new Error();
      const parsed: Sheet[] = await response.json();
      if (!parsed.some((item) => item.rows.length > 1)) throw new Error();
      setSheets(parsed);
      selectSheet(parsed, parsed.findIndex((item) => item.rows.length > 1));
    } catch {
      setError(t("fileError"));
    } finally {
      setBusy(false);
    }
  }

  async function save(rows: Row[]) {
    if (busy || !branchId || !rows.length) return;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([branchId, rows]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      const saved = [];
      for (let offset = 0; offset < rows.length; offset += 100) {
        const chunk = rows.slice(offset, offset + 100);
        const response = await apiPost<{ results: Result[] }>("/assets/import", {
          branchId, requestId: request.current.id, offset, rows: chunk.map(({ values }) => values),
        });
        for (const result of response.results) {
          const row = chunk[result.row - 1];
          saved.push({ sourceRow: row.sourceRow, name: row.values.name, tag: result.tag, assetId: result.assetId });
        }
      }
      setResults([...saved, ...preview.filter((row) => !readyIds.has(row.sourceRow)).map((row) => ({
        sourceRow: row.sourceRow, name: row.values.name, tag: row.values.tag,
        invalid: !duplicateRows.has(row.sourceRow),
      }))].sort((left, right) => left.sourceRow - right.sourceRow));
    } catch {
      setError(a("bulkError"));
    } finally {
      setBusy(false);
    }
  }

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const serials = String(data.get("serials") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (quantity > 1 && (serials.length > quantity || serials.some((serial) => serial.length > limits.serial))) {
      setError(t("serialError"));
      return;
    }
    const values = Object.fromEntries(columns.map((key) => [key, String(data.get(key) ?? "").trim()])) as AssetInput;
    if (!values.category) {
      setError(t("chooseCategory"));
      return;
    }
    void save(Array.from({ length: quantity }, (_, index) => ({
      sourceRow: index + 1,
      values: { ...values, serial: quantity === 1 ? values.serial : serials[index] ?? "" },
    })));
  }

  function downloadResults() {
    if (!results) return;
    const quote = (value: string) => {
      const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
      return '"' + safe.replaceAll('"', '""') + '"';
    };
    const csv = [["Row", "Item", "Tag", "Result"], ...results.map((row) => [
      String(row.sourceRow), row.name, row.tag, row.invalid ? t("invalid") : a(row.assetId ? "saved" : "duplicate"),
    ])].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "chuflow-asset-results.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <Card className="mx-auto max-w-4xl space-y-5 p-5 sm:p-7">
    <Field label={common("branch")}><select className="ui-input" value={branchId} disabled={busy || !!results} onChange={(e) => setBranchId(e.target.value)}>
      <option value="">{a("chooseBranch")}</option>
      {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
    </select></Field>
    {results ? <>
      <AssetLabels items={results.flatMap((row) => row.assetId ? [{ _id: row.assetId, tag: row.tag, name: row.name }] : [])} />
      {mode === "import" ? <Button variant="secondary" onClick={downloadResults}>{t("results")}</Button> : null}
      <ul className="max-h-80 divide-y overflow-auto text-sm">
        {results.map((row) => <li key={row.sourceRow} className="py-2">{row.sourceRow}. {row.name} · {row.tag} · {row.invalid ? t("invalid") : a(row.assetId ? "saved" : "duplicate")}</li>)}
      </ul>
      <Button variant="secondary" onClick={() => { setResults(undefined); setSheets([]); request.current = null; }}>{t("another")}</Button>
    </> : mode === "register" ? (
      <form onSubmit={register} className="grid gap-4 sm:grid-cols-2">
        <Field label={t("quantity")}><input className="ui-input" type="number" min={1} max={100} required value={quantity} onChange={(event) => setQuantity(event.target.valueAsNumber || 1)} /></Field>
        {columns.filter((key) => quantity === 1 || (key !== "tag" && key !== "serial")).map((key) => (
          key === "category" ? <AssetCategoryPicker key={branchId} branchId={branchId} /> : <Field key={key} label={a(key)} hint={key === "tag" ? t("automatic") : undefined}>
            <input className="ui-input" name={key} maxLength={limits[key]} required={key === "name"} />
          </Field>
        ))}
        {quantity > 1 ? <Field label={t("serials")}><textarea className="ui-input" name="serials" rows={4} maxLength={10100} /></Field> : null}
        <div className="sm:col-span-2"><Button type="submit" disabled={busy || !branchId}>{a("register")}</Button></div>
      </form>
    ) : <>
      <form onSubmit={load} className="space-y-3">
        <Field label={t("file")}><input className="ui-input" type="file" name="file" accept=".xlsx,.csv,.tsv" required /></Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>{t("preview")}</Button>
          <a className="self-center text-sm underline" download="chuflow-assets.csv" href="data:text/csv;charset=utf-8,tag%2Cname%2Ccategory%2Clocation%2Cserial%0A">{t("template")}</a>
        </div>
      </form>
      {sheet ? <div className="space-y-4">
        {sheets.length > 1 ? <Field label={t("sheet")}><select className="ui-input" value={sheetIndex} onChange={(e) => selectSheet(sheets, Number(e.target.value))}>
          {sheets.map((item, index) => <option key={index} value={index}>{item.name}</option>)}
        </select></Field> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {columns.map((key) => <Field key={key} label={a(key)}><select className="ui-input" value={mapping[key] ?? -1} onChange={(e) => setMapping({ ...mapping, [key]: Number(e.target.value) })}>
            <option value={-1}>—</option>
            {sheet.rows[0]?.cells.map((heading, index) => <option key={index} value={index}>{heading || index + 1}</option>)}
          </select></Field>)}
        </div>
        <p className="text-sm">{t("summary", { ready: ready.length, invalid: preview.length - ready.length })}</p>
        <ul className="max-h-60 divide-y overflow-auto text-sm">
          {preview.slice(0, 100).map((row) => <li key={row.sourceRow} className="py-2">{row.sourceRow}. {row.values.name || "—"} · {readyIds.has(row.sourceRow) ? row.values.tag || t("automatic") : duplicateRows.has(row.sourceRow) ? a("duplicate") : t("invalid")}</li>)}
        </ul>
        <Button disabled={busy || !branchId || !ready.length} onClick={() => void save(ready)}>{a("bulkImport")}</Button>
      </div> : null}
    </>}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </Card>;
}
