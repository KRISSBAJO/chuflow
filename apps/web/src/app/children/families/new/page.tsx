import Link from "next/link";
import { redirect } from "next/navigation";
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
  const q = await searchParams;
  return (
    <>
      <Link href="/children" className="text-sm">
        ← Back to children’s workspace
      </Link>
      <FamilyForm options={options} initialBranchId={q.branchId} />
    </>
  );
}
