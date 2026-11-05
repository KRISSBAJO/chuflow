import Link from "next/link";
import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalPolicyForm } from "@/components/approval-workflows/policy-form";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page() {
  await requireServerRole("/approvals/routes");
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  return (
    <Shell>
      <Link href="/approvals/routes" className="text-sm hover:underline">
        ← Back to routes
      </Link>
      <PageHeader
        eyebrow="Approval settings"
        title="New approval route"
        description="Choose the category and final approving level."
      />
      <ApprovalPolicyForm regions={data.regions} />
    </Shell>
  );
}
