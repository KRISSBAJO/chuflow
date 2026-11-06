import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalPolicyForm } from "@/components/approval-workflows/policy-form";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page() {
  await requireServerRole("/approvals/routes");
  const t = await getTranslations("admin.approvalRoutes");
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  return (
    <Shell>
      <Link href="/approvals/routes" className="text-sm hover:underline">
        {t("backToRoutes")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("newTitle")}
        description={t("newDescription")}
      />
      <ApprovalPolicyForm regions={data.regions} />
    </Shell>
  );
}
