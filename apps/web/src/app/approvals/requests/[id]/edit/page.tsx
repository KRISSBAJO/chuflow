import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("admin.approvalRequests");
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
        {t("backToRequest")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("reviseTitle")}
        description={t("reviseDescription")}
      />
      <ApprovalRequestForm options={options} request={r} />
    </Shell>
  );
}
