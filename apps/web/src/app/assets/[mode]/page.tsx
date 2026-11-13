import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AssetIntake } from "@/components/asset-intake";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function AssetIntakePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (mode !== "register" && mode !== "import") notFound();
  const user = await requireServerRole("/assets");
  const [branches, t, common] = await Promise.all([
    serverGet<BranchSummary[]>("/branches"), getTranslations("admin.assets"), getTranslations("common"),
  ]);
  return <Shell>
    <PageHeader eyebrow={t("eyebrow")} description={t("description")} title={t(mode === "register" ? "register" : "bulkImport")}
      action={<Link className={buttonClass("secondary", "md")} href="/assets">{common("back")}</Link>} />
    <AssetIntake mode={mode} branches={branches} defaultBranchId={user.branchId} />
  </Shell>;
}
