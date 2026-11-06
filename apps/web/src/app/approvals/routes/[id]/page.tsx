import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ApprovalPolicyForm } from "@/components/approval-workflows/policy-form";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/approvals/routes");
  const t = await getTranslations("admin.approvalRoutes");
  const { id } = await params;
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  const p = data.policies.find((p) => p._id === id);
  if (!p) notFound();
  return (
    <Shell>
      <Link href="/approvals/routes" className="text-sm hover:underline">
        {t("backToRoutes")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={p.name}
        description={t("editDescription")}
      />
      <ApprovalPolicyForm regions={data.regions} policy={p} />
    </Shell>
  );
}
