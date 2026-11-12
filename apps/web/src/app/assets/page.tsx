import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssetsWorkspace, type InventoryAsset } from "@/components/assets-workspace";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function AssetsPage({ searchParams }: {
  searchParams: Promise<{ tag?: string; before?: string; branchId?: string; assetId?: string }>;
}) {
  const user = await requireServerRole("/assets");
  const { tag, before, branchId, assetId } = await searchParams;
  const query = new URLSearchParams();
  if (typeof tag === "string" && tag.trim()) query.set("tag", tag.trim().slice(0, 64));
  if (typeof branchId === "string" && /^[a-f0-9]{24}$/i.test(branchId)) query.set("branchId", branchId);
  if (typeof before === "string" && /^[a-f0-9]{24}$/i.test(before)) query.set("before", before);
  if (typeof assetId === "string" && /^[a-f0-9]{24}$/i.test(assetId)) query.set("assetId", assetId);
  const [inventory, branches, t, tc] = await Promise.all([
    serverGet<{ items: InventoryAsset[]; next: string | null; asOf: number }>("/assets?" + query),
    serverGet<BranchSummary[]>("/branches"),
    getTranslations("admin.assets"),
    getTranslations("common"),
  ]);

  const first = new URLSearchParams(query);
  first.delete("before");
  if (inventory.next) query.set("before", inventory.next);

  return <Shell>
    <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
    <AssetsWorkspace items={inventory.items} branches={branches} defaultBranchId={user.branchId}
      tag={first.get("tag") ?? ""} branchId={first.get("branchId") ?? ""} asOf={inventory.asOf} />
    <nav className="flex flex-wrap gap-2">
      {before ? <Link className={buttonClass("secondary", "sm")} href={"/assets?" + first}>{t("firstPage")}</Link> : null}
      {inventory.next ? <Link className={buttonClass("secondary", "sm")} href={"/assets?" + query}>{tc("next")}</Link> : null}
    </nav>
  </Shell>;
}
