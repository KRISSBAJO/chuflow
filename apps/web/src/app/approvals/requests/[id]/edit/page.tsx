import Link from "next/link";
import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalRequestForm } from "@/components/approval-workflows/request-form";
import type {
  ApprovalOptions,
  ApprovalRequest,
} from "@/lib/approval-workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await requireServerRole("/approvals/requests");
  const { id } = await params;
  const [options, r] = await Promise.all([
    serverGet<ApprovalOptions>("/approval-workflows/options"),
    serverGet<ApprovalRequest>(
      `/approval-workflows/requests/${encodeURIComponent(id)}`,
    ),
  ]);
  if (r.requesterId !== (u._id || u.id) || r.status !== "returned")
    redirect(`/approvals/requests/${id}`);
  return (
    <Shell>
      <Link
        href={`/approvals/requests/${id}`}
        className="text-sm hover:underline"
      >
        ← Back to request
      </Link>
      <PageHeader
        eyebrow="General approvals"
        title="Revise and resubmit"
        description="Resubmission starts a fresh review using the current route. Previous decisions remain in the history."
      />
      <ApprovalRequestForm options={options} request={r} />
    </Shell>
  );
}
