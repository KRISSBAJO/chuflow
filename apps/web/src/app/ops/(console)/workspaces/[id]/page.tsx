import { notFound } from "next/navigation";
import { AuditTable } from "@/components/ops/audit-table";
import { AccessBadge, Notice, OpsPageHeader, StatusBadge } from "@/components/ops/ops-ui";
import { SubscriptionPanel } from "@/components/ops/subscription-panel";
import { WorkspaceActions } from "@/components/ops/workspace-actions";
import { WorkspaceEditForm } from "@/components/ops/workspace-edit-form";
import { Card, CardHeader } from "@/components/ui/ui";
import { opsGet, opsGetOptional, requireOperator } from "@/lib/ops/session";
import { can, formatDate, QUOTA_KEYS, QUOTA_LABELS, type AuditEntry, type Plan, type WorkspaceDetail, type WorkspaceUsage } from "@/lib/ops/types";

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function OpsWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const [operator, { id }] = await Promise.all([requireOperator(), params]);
  if (id.length > 64 || !HANDLE.test(id)) notFound();
  const detail = await opsGetOptional<WorkspaceDetail>(`/workspaces/${id}`);
  if (!detail) notFound();
  const [usage, plans, audit] = await Promise.all([
    opsGet<WorkspaceUsage>(`/workspaces/${id}/usage`).catch(() => null),
    opsGet<Plan[]>("/plans"),
    opsGet<AuditEntry[]>(`/audit?workspaceId=${encodeURIComponent(id)}&limit=25`).catch(() => [] as AuditEntry[]),
  ]);
  const { workspace, subscription, entitlements } = detail;

  return (
    <>
      <OpsPageHeader
        eyebrow="Workspace"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {workspace.name}
            <StatusBadge status={workspace.status} />
          </span>
        }
        description={
          <>
            <span className="font-mono text-[13px]">{workspace.id}</span>
            {workspace.primary ? " · the primary workspace, configured by environment" : workspace.createdAt ? ` · provisioned ${formatDate(workspace.createdAt)}` : ""}
          </>
        }
        back={{ href: "/ops/workspaces", label: "Workspaces" }}
        action={<WorkspaceActions workspace={workspace} role={operator.role} />}
      />

      {workspace.status === "suspended" ? (
        <Notice tone="error" title={`Suspended ${formatDate(workspace.suspendedAt, true)}`}>
          {workspace.suspensionReason ?? "No reason was recorded."} Every request to this workspace answers 402 until it is reactivated.
        </Notice>
      ) : null}
      {workspace.status === "archived" ? <Notice tone="neutral" title={`Archived ${formatDate(workspace.archivedAt, true)}`}>The gateway no longer serves this workspace. Its database is kept.</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <CardHeader title="Details" />
          <div className="mt-4">
            <WorkspaceEditForm workspace={workspace} editable={can.editWorkspace(operator.role)} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <CardHeader title="Usage against quotas" description={usage ? <>Counted live from the workspace database. <AccessBadge access={usage.access} /></> : undefined} />
          {usage ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {QUOTA_KEYS.map((key) => {
                const limit = usage.quotas[key];
                const count = usage.counts[key];
                const ratio = limit ? Math.min(count / limit, 1) : 0;
                const over = limit !== null && count >= limit;
                return (
                  <div key={key} className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                    <p className="text-[12px] font-medium text-[#6b6b6b]">{QUOTA_LABELS[key]}</p>
                    <p className="mt-1 text-[20px] font-semibold leading-none tabular-nums">
                      {count}
                      <span className="text-[13px] font-normal text-[#8a8780]"> / {limit === null ? "∞" : limit}</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                      <div className={`h-full rounded-full ${over ? "bg-red-500" : ratio > 0.8 ? "bg-amber-500" : "lp-flame-bg"}`} style={{ width: `${limit === null ? 4 : Math.max(ratio * 100, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                <p className="text-[12px] font-medium text-[#6b6b6b]">Guests</p>
                <p className="mt-1 text-[20px] font-semibold leading-none tabular-nums">{usage.counts.guests}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Notice tone="neutral">Usage could not be read. The workspace database may not have been created yet.</Notice>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <CardHeader title="Subscription" description="What this church is entitled to right now, as its own API computes it." />
        <div className="mt-5">
          <SubscriptionPanel workspaceId={workspace.id} subscription={subscription} entitlements={entitlements} plans={plans} canEdit={can.billing(operator.role)} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardHeader title="History" description="Operator actions on this workspace." />
        <div className="mt-4">
          <AuditTable entries={audit} showWorkspace={false} />
        </div>
      </Card>
    </>
  );
}
