import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  const { id } = await params;
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  const p = data.policies.find((p) => p._id === id);
  if (!p) notFound();
  return (
    <Shell>
      <Link href="/approvals/routes" className="text-sm hover:underline">
        ← Back to routes
      </Link>
      <PageHeader
        eyebrow="Approval settings"
        title={p.name}
        description="Changes affect future submissions, preserving existing decision histories."
      />
      <ApprovalPolicyForm regions={data.regions} policy={p} />
    </Shell>
  );
}
