"use client";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/ui";
import { useSession } from "@/components/session-context";
import { useTranslations } from "next-intl";

const TABLES: Record<string, string[]> = {
  "/hierarchy": ["hierarchy", "hierarchy-churches"],
  "/care": ["care"],
  "/meetings": ["meetings"],
  "/members": ["members"],
  "/guests": ["guests"],
  "/users": ["users"],
  "/branches": ["branches"],
  "/service-units": ["service-units"],
  "/templates": ["templates"],
  "/follow-up": ["follow-up"],
  "/evangelism": ["evangelism"],
  "/evangelism/links": ["evangelism-links"],
  "/communications": ["communications"],
  "/weekly-reports": ["weekly-reports"],
  "/maag-reports": ["maag-reports"],
  "/reports": ["reports"],
  "/finance": [
    "ledger",
    "offerings",
    "expenses",
    "finance-accounts",
    "offering-types",
    "expense-categories",
  ],
  "/approvals": [
    "attendance-approvals",
    "expense-approvals",
    "workspace-requests",
    "audit-logs",
  ],
};

export function ExportTableButtons({
  resource,
  rows,
  label,
  filters,
}: {
  resource: string;
  rows?: unknown[];
  label?: string;
  filters?: Record<string, string>;
}) {
  const query = useSearchParams();
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(format: "xlsx" | "csv") {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams(query.toString());
      for (const [key, value] of Object.entries(filters || {}))
        params.set(key, value);
      params.set("format", format);
      const response = await fetch(
        `/api/exports/${resource}?${params}`,
        rows
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows }),
            }
          : undefined,
      );
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message || t("downloadFailed"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `chuflow-${resource}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("downloadFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[#6b6b6b]">
          {label ?? t("downloadTable")}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => download("xlsx")}
        >
          {busy ? t("preparing") : t("excelFile")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => download("csv")}
        >
          {t("csvSheets")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function TableExportToolbar() {
  const path = usePathname();
  const params = useSearchParams();
  const { user } = useSession();
  const t = useTranslations("common");
  const tt = useTranslations("exportTables");
  const tables = (TABLES[path] || []).filter(
    (id) => id !== "workspace-requests" || user?.role === "super_admin",
  );
  const [selected, setSelected] = useState("");
  if (
    !tables.length ||
    ["/members", "/users", "/weekly-reports"].includes(path)
  )
    return null;
  const tabMap: Record<string, string> = {
    ledger: "ledger",
    offerings: "offerings",
    expenses: "expenses",
    attendance: "attendance-approvals",
    finance: "expense-approvals",
    workspace: "workspace-requests",
    governance: "audit-logs",
  };
  const defaultResource =
    tables.find((id) => id === tabMap[params.get("tab") || ""]) || tables[0];
  const resource = tables.some((id) => id === selected)
    ? selected
    : defaultResource;
  return (
    <section
      aria-label={t("tableDownloads")}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white p-4"
    >
      <div>
        <p className="text-sm font-medium">{t("exportYourTable")}</p>
        <p className="mt-1 text-xs text-[#8a8780]">{t("exportHint")}</p>
      </div>
      {tables.length > 1 && (
        <label className="text-xs text-[#6b6b6b]">
          {t("table")}
          <select
            className="ui-input mt-1"
            value={resource}
            onChange={(event) => setSelected(event.target.value)}
          >
            {tables.map((id) => (
              <option key={id} value={id}>
                {tt(id as Parameters<typeof tt>[0])}
              </option>
            ))}
          </select>
        </label>
      )}
      <ExportTableButtons
        key={`${path}-${resource}`}
        resource={resource}
        label=""
      />
    </section>
  );
}
