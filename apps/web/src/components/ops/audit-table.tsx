import Link from "next/link";
import { EmptyState, TableWrap } from "@/components/ui/ui";
import { formatDate, type AuditEntry } from "@/lib/ops/types";
import { label } from "./ops-ui";

const ACTIONS: Record<string, string> = {
  "workspace.provisioned": "Provisioned workspace",
  "workspace.updated": "Updated workspace details",
  "workspace.suspended": "Suspended workspace",
  "workspace.active": "Reactivated workspace",
  "workspace.archived": "Archived workspace",
  "subscription.created": "Assigned a plan",
  "subscription.updated": "Changed the subscription",
  "subscription.payment": "Recorded a payment",
  "plan.saved": "Saved a plan",
  "operator.created": "Added an operator",
  "operator.updated": "Updated an operator",
};

export function describeAction(action: string) {
  return ACTIONS[action] ?? label(action.replace(/\./g, " "));
}

function summarize(details?: Record<string, unknown>) {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export function AuditTable({ entries, showWorkspace = true }: { entries: AuditEntry[]; showWorkspace?: boolean }) {
  if (!entries.length) return <EmptyState icon="clock" title="Nothing recorded yet">Operator actions appear here with who did them and why.</EmptyState>;
  return (
    <TableWrap>
      <table className="ui-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            {showWorkspace ? <th>Workspace</th> : null}
            <th>Operator</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap tabular-nums text-[#6b6b6b]">{formatDate(entry.at, true)}</td>
              <td className="font-medium">{describeAction(entry.action)}</td>
              {showWorkspace ? (
                <td>
                  {entry.workspaceId ? (
                    <Link href={`/ops/workspaces/${entry.workspaceId}`} className="underline underline-offset-4">
                      {entry.workspaceId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              <td className="text-[#6b6b6b]">{entry.operatorEmail}</td>
              <td className="max-w-[360px] text-[13px] text-[#6b6b6b]">
                {entry.reason ? <p className="text-[#111111]">“{entry.reason}”</p> : null}
                <p className="truncate" title={summarize(entry.details)}>
                  {summarize(entry.details)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
