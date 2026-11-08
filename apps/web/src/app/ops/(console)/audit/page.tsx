import { AuditTable } from "@/components/ops/audit-table";
import { OpsPageHeader } from "@/components/ops/ops-ui";
import { buttonClass, Card } from "@/components/ui/ui";
import { opsGet, requireOperator } from "@/lib/ops/session";
import type { AuditEntry, WorkspaceView } from "@/lib/ops/types";

export default async function OpsAuditPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string; limit?: string }> }) {
  const [, params] = await Promise.all([requireOperator(), searchParams]);
  const workspaceId = params.workspaceId && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.workspaceId) ? params.workspaceId : "";
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);
  const query = new URLSearchParams({ limit: String(limit) });
  if (workspaceId) query.set("workspaceId", workspaceId);
  const [entries, workspaces] = await Promise.all([opsGet<AuditEntry[]>(`/audit?${query}`), opsGet<WorkspaceView[]>("/workspaces").catch(() => [] as WorkspaceView[])]);

  return (
    <>
      <OpsPageHeader eyebrow="Compliance" title="Audit log" description="Every operator action, newest first, with the reason given at the time." />
      <Card className="p-5 sm:p-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="block min-w-[220px]">
            <span className="mb-1.5 block text-[13px] font-medium">Workspace</span>
            <select name="workspaceId" className="ui-input" defaultValue={workspaceId}>
              <option value="">All workspaces</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.id})
                </option>
              ))}
            </select>
          </label>
          <label className="block w-32">
            <span className="mb-1.5 block text-[13px] font-medium">Show</span>
            <select name="limit" className="ui-input" defaultValue={String(limit)}>
              {[50, 100, 250, 500].map((value) => (
                <option key={value} value={value}>
                  {value} entries
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            Apply
          </button>
        </form>
        <div className="mt-5">
          <AuditTable entries={entries} />
        </div>
      </Card>
    </>
  );
}
