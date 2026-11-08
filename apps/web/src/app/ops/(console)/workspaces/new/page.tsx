import { redirect } from "next/navigation";
import { OpsPageHeader } from "@/components/ops/ops-ui";
import { ProvisionForm } from "@/components/ops/provision-form";
import { opsGet, requireOperator } from "@/lib/ops/session";
import { can, type Plan } from "@/lib/ops/types";

export default async function ProvisionWorkspacePage() {
  const operator = await requireOperator();
  if (!can.provision(operator.role)) redirect("/ops/workspaces");
  const plans = await opsGet<Plan[]>("/plans");
  return (
    <>
      <OpsPageHeader
        eyebrow="Tenants"
        title="Provision a workspace"
        description="Creates the church's database, seals its secrets and starts its plan. The gateway serves it on its first request."
        back={{ href: "/ops/workspaces", label: "Workspaces" }}
      />
      <ProvisionForm plans={plans} />
    </>
  );
}
