import Link from "next/link";
import { AuditTable } from "@/components/ops/audit-table";
import { OpsPageHeader, StatusBadge, Notice } from "@/components/ops/ops-ui";
import { ButtonLink, Card, CardHeader, Stat, EmptyState } from "@/components/ui/ui";
import { opsGet, requireOperator } from "@/lib/ops/session";
import { can, formatDate, formatMoney, type AuditEntry, type Overview, type Plan, type WorkspaceView } from "@/lib/ops/types";

export default async function OpsOverviewPage() {
  const operator = await requireOperator();
  const [overview, workspaces, audit, plans] = await Promise.all([
    opsGet<Overview>("/overview"),
    opsGet<WorkspaceView[]>("/workspaces"),
    opsGet<AuditEntry[]>("/audit?limit=8").catch(() => [] as AuditEntry[]),
    opsGet<Plan[]>("/plans").catch(() => [] as Plan[]),
  ]);
  const currency = plans[0]?.currency ?? "USD";
  const attention = workspaces.filter((workspace) => workspace.status === "suspended" || workspace.status === "provisioning");
  const billing = overview.billing.byStatus;
  const needsBilling = (billing.past_due ?? 0) + (billing.delinquent ?? 0);

  return (
    <>
      <OpsPageHeader
        eyebrow="Control plane"
        title="Overview"
        description="Every church on ChuFlow, its plan and its health, in one place."
        action={can.provision(operator.role) ? <ButtonLink href="/ops/workspaces/new" variant="flame" icon="plus">Provision workspace</ButtonLink> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Workspaces" value={overview.workspaces.total} hint={`${overview.workspaces.byStatus.active ?? 0} active`} />
        <Stat label="Suspended" value={overview.workspaces.byStatus.suspended ?? 0} hint={`${overview.workspaces.byStatus.archived ?? 0} archived`} />
        <Stat label="Monthly recurring" value={formatMoney(overview.billing.monthlyRecurringCents, currency)} hint={`${overview.billing.subscriptions} subscriptions`} />
        <Stat label="Trials" value={billing.trialing ?? 0} hint={needsBilling ? `${needsBilling} overdue` : "No overdue accounts"} />
      </div>

      {needsBilling ? (
        <Notice tone="info" title="Payments need attention">
          {needsBilling} {needsBilling === 1 ? "subscription is" : "subscriptions are"} past due or delinquent. Open the workspace to record a payment or extend the period.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <CardHeader title="Workspaces" description="Newest first. The primary workspace is configured by environment." action={<Link href="/ops/workspaces" className="text-[13px] font-medium underline underline-offset-4">View all</Link>} />
          <ul className="mt-4 divide-y divide-black/[0.06]">
            {[...workspaces].reverse().slice(0, 8).map((workspace) => (
              <li key={workspace.id}>
                <Link href={`/ops/workspaces/${workspace.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{workspace.name}</p>
                    <p className="truncate text-[12px] text-[#8a8780]">
                      {workspace.id}
                      {workspace.region ? ` · ${workspace.region}` : ""}
                      {workspace.createdAt ? ` · ${formatDate(workspace.createdAt)}` : " · primary"}
                    </p>
                  </div>
                  <StatusBadge status={workspace.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <CardHeader title="Needs attention" />
            {attention.length ? (
              <ul className="mt-4 space-y-2">
                {attention.map((workspace) => (
                  <li key={workspace.id} className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                    <Link href={`/ops/workspaces/${workspace.id}`} className="flex items-center justify-between gap-3">
                      <span className="truncate text-[14px] font-medium">{workspace.name}</span>
                      <StatusBadge status={workspace.status} />
                    </Link>
                    {workspace.suspensionReason ? <p className="mt-1 text-[12px] text-[#6b6b6b]">{workspace.suspensionReason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState icon="check" title="All clear">No workspace is suspended or stuck provisioning.</EmptyState>
              </div>
            )}
          </Card>
          <Card className="p-5 sm:p-6">
            <CardHeader title="Plans" action={<Link href="/ops/plans" className="text-[13px] font-medium underline underline-offset-4">Manage</Link>} />
            <ul className="mt-4 space-y-2 text-[14px]">
              {plans.map((plan) => (
                <li key={plan._id} className="flex items-center justify-between gap-3">
                  <span className={plan.retired ? "text-[#8a8780] line-through" : ""}>{plan.name}</span>
                  <span className="tabular-nums text-[#6b6b6b]">{formatMoney(plan.priceMonthlyCents, plan.currency)}/mo</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <CardHeader title="Recent activity" action={<Link href="/ops/audit" className="text-[13px] font-medium underline underline-offset-4">Full audit log</Link>} />
        <div className="mt-4">
          <AuditTable entries={audit} />
        </div>
      </Card>
    </>
  );
}
