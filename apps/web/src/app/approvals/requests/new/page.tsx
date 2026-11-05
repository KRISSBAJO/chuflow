import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalRequestForm } from "@/components/approval-workflows/request-form";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page() {
  const u = await requireServerRole("/approvals/requests/new");
  const options = await serverGet<ApprovalOptions>(
    "/approval-workflows/options",
  );
  return (
    <Shell>
      <Link href="/approvals/requests" className="text-sm hover:underline">
        ← Back to requests
      </Link>
      <PageHeader
        eyebrow="General approvals"
        title="New request"
        description="Choose the configured route and preview the people who will review your request."
      />
      <ApprovalRequestForm options={options} homeBranchId={u.branchId} />
    </Shell>
  );
}
