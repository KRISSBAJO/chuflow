import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverGet } from "@/lib/server-api";
import { FamilyForm } from "@/components/children/forms";
import type { ChildrenOptions } from "@/lib/children";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const options = await serverGet<ChildrenOptions>("/children/options");
  if (!options.canManage) redirect("/children");
  const [q, t] = await Promise.all([
    searchParams,
    getTranslations("childrenRecords"),
  ]);
  return (
    <>
      <Link href="/children" className="kids-chip">
        {t("back.workspace")}
      </Link>
      <FamilyForm options={options} initialBranchId={q.branchId} />
    </>
  );
}
