import { redirect } from "next/navigation";
import { OperatorsManager } from "@/components/ops/operators-manager";
import { OpsPageHeader } from "@/components/ops/ops-ui";
import { opsGet, requireOperator } from "@/lib/ops/session";
import { can, type OperatorView } from "@/lib/ops/types";

export default async function OpsOperatorsPage() {
  const operator = await requireOperator();
  if (!can.manageOperators(operator.role)) redirect("/ops");
  const operators = await opsGet<OperatorView[]>("/operators");
  return (
    <>
      <OpsPageHeader eyebrow="Access" title="Operators" description="People who can sign in to this console. Every action they take is written to the audit log." />
      <OperatorsManager operators={operators} selfId={operator.sub} />
    </>
  );
}
