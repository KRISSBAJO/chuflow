"use client";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/ui";
import { useSession } from "@/components/session-context";

const TABLES: Record<string, [string, string][]> = {
 "/care": [["care","Care records"]],
  "/meetings": [["meetings", "Meetings"]],
  "/members": [["members", "Members"]],
  "/guests": [["guests", "Guests"]],
  "/users": [["users", "Users"]],
  "/branches": [["branches", "Branches"]],
  "/service-units": [["service-units", "Service units"]],
  "/templates": [["templates", "Templates"]],
  "/follow-up": [["follow-up", "Follow-up"]],
  "/evangelism": [["evangelism", "Evangelism contacts"]],
  "/evangelism/links": [["evangelism-links", "Shareable links"]],
  "/communications": [["communications", "Communications"]],
  "/weekly-reports": [["weekly-reports", "Weekly reports"]],
  "/maag-reports": [["maag-reports", "MAAG reports"]],
  "/reports": [["reports", "Reports"]],
  "/finance": [
    ["ledger", "Ledger"],
    ["offerings", "Offerings"],
    ["expenses", "Expenses"],
    ["finance-accounts", "Accounts"],
    ["offering-types", "Offering types"],
    ["expense-categories", "Expense categories"],
  ],
  "/approvals": [
    ["attendance-approvals", "Attendance approvals"],
    ["expense-approvals", "Expense approvals"],
    ["workspace-requests", "Workspace requests"],
    ["audit-logs", "Audit logs"],
  ],
};

export function ExportTableButtons({
  resource,
  rows,
  label = "Download table",
}: {
  resource: string;
  rows?: unknown[];
  label?: string;
}) {
  const query = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download(format: "xlsx" | "csv") {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams(query.toString());
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
        throw new Error(body.message || "Download failed. Please try again.");
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
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[#6b6b6b]">{label}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => download("xlsx")}
        >
          {busy ? "Preparing…" : "Excel (.xlsx)"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => download("csv")}
        >
          CSV / Google Sheets
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
  const tables = (TABLES[path] || []).filter(
    ([id]) => id !== "workspace-requests" || user?.role === "super_admin",
  );
  const [selected, setSelected] = useState("");
  if (!tables.length) return null;
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
    tables.find(([id]) => id === tabMap[params.get("tab") || ""])?.[0] ||
    tables[0][0];
  const resource = tables.some(([id]) => id === selected)
    ? selected
    : defaultResource;
  return (
    <section
      aria-label="Table downloads"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white p-4"
    >
      <div>
        <p className="text-sm font-medium">Export your table</p>
        <p className="mt-1 text-xs text-[#8a8780]">
          All matching records across pages. Import either file into Google
          Sheets using File → Import → Upload.
        </p>
      </div>
      {tables.length > 1 && (
        <label className="text-xs text-[#6b6b6b]">
          Table
          <select
            className="ui-input mt-1"
            value={resource}
            onChange={(event) => setSelected(event.target.value)}
          >
            {tables.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
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
