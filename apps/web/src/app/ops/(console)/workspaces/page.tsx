import Link from "next/link";
import { OpsPageHeader, StatusBadge } from "@/components/ops/ops-ui";
import { ButtonLink, Card, EmptyState, TableWrap, TabLinks } from "@/components/ui/ui";
import { opsGet, requireOperator } from "@/lib/ops/session";
import { can, formatDate, WORKSPACE_STATUSES, type WorkspaceStatus, type WorkspaceView } from "@/lib/ops/types";

export default async function OpsWorkspacesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [operator, params] = await Promise.all([requireOperator(), searchParams]);
  const status = WORKSPACE_STATUSES.includes(params.status as WorkspaceStatus) ? (params.status as WorkspaceStatus) : undefined;
  const [workspaces, all] = await Promise.all([
    opsGet<WorkspaceView[]>(status ? `/workspaces?status=${status}` : "/workspaces"),
    status ? opsGet<WorkspaceView[]>("/workspaces") : Promise.resolve<WorkspaceView[] | null>(null),
  ]);
  const everything = all ?? workspaces;
  const count = (value?: WorkspaceStatus) => (value ? everything.filter((workspace) => workspace.status === value).length : everything.length);

  return (
    <>
      <OpsPageHeader
        eyebrow="Tenants"
        title="Workspaces"
        description="Each workspace is a church on its own database with its own sign-in secret."
        action={can.provision(operator.role) ? <ButtonLink href="/ops/workspaces/new" variant="flame" icon="plus">Provision workspace</ButtonLink> : undefined}
      />
      <TabLinks
        items={[
          { href: "/ops/workspaces", label: "All", count: count(), active: !status },
          ...WORKSPACE_STATUSES.map((value) => ({ href: `/ops/workspaces?status=${value}`, label: value.charAt(0).toUpperCase() + value.slice(1), count: count(value), active: status === value })),
        ]}
      />
      <Card className="p-5 sm:p-6">
        {workspaces.length ? (
          <TableWrap>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Region</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <Link href={`/ops/workspaces/${workspace.id}`} className="font-medium underline-offset-4 hover:underline">
                        {workspace.name}
                      </Link>
                      <p className="text-[12px] text-[#8a8780]">
                        {workspace.id}
                        {workspace.primary ? " · primary" : ""}
                      </p>
                    </td>
                    <td>
                      <StatusBadge status={workspace.status} />
                    </td>
                    <td className="text-[#6b6b6b]">{workspace.adminEmail ?? "—"}</td>
                    <td className="text-[#6b6b6b]">{workspace.region ?? "—"}</td>
                    <td className="whitespace-nowrap tabular-nums text-[#6b6b6b]">{formatDate(workspace.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState icon="branches" title="No workspaces here">
            {status ? `No workspace is ${status} right now.` : "Provision the first workspace to get started."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
