import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalRequestForm } from "@/components/approval-workflows/request-form";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page() {
  const u = await requireServerRole("/approvals/requests/new");
  const t = await getTranslations("admin.approvalRequests");
  const options = await serverGet<ApprovalOptions>(
    "/approval-workflows/options",
  );
  return (
    <Shell>
      <Link href="/approvals/requests" className="text-sm hover:underline">
        {t("backToRequests")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("newTitle")}
        description={t("newDescription")}
      />
      <ApprovalRequestForm options={options} homeBranchId={u.branchId} />
    </Shell>
  );
}
