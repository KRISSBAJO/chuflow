import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AssetIntake } from "@/components/asset-intake";
import { AssetRoomOperations } from "@/components/asset-room-operations";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function AssetIntakePage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (mode !== "register" && mode !== "import" && mode !== "kits" && mode !== "stocktakes") notFound();
  const user = await requireServerRole("/assets");
  const [branches, t, common, operations] = await Promise.all([
    serverGet<BranchSummary[]>("/branches"), getTranslations("admin.assets"), getTranslations("common"), getTranslations("common.assetOperations"),
  ]);
  return <Shell>
    <PageHeader eyebrow={t("eyebrow")} description={t("description")} title={mode === "kits" || mode === "stocktakes" ? operations(mode) : t(mode === "register" ? "register" : "bulkImport")}
      action={<Link className={buttonClass("secondary", "md")} href="/assets">{common("back")}</Link>} />
    {mode === "kits" || mode === "stocktakes" ? <AssetRoomOperations mode={mode} branches={branches} defaultBranchId={user.branchId} />
      : <AssetIntake mode={mode} branches={branches} defaultBranchId={user.branchId} />}
  </Shell>;
}
