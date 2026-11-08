import { OpsPageHeader } from "@/components/ops/ops-ui";
import { PlanEditor } from "@/components/ops/plan-editor";
import { opsGet, requireOperator } from "@/lib/ops/session";
import { can, type Plan } from "@/lib/ops/types";

export default async function OpsPlansPage() {
  const operator = await requireOperator();
  const plans = await opsGet<Plan[]>("/plans");
  return (
    <>
      <OpsPageHeader eyebrow="Catalog" title="Plans" description="What each plan includes. Workspaces inherit features and quotas from their plan, with per-church overrides on the subscription." />
      <PlanEditor plans={plans} canEdit={can.billing(operator.role)} />
    </>
  );
}
