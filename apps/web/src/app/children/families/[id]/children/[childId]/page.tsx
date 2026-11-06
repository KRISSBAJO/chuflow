import Link from "next/link";
import { notFound } from "next/navigation";
import { serverGet } from "@/lib/server-api";
import { ChildForm } from "@/components/children/forms";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; childId: string }>;
}) {
  const { id, childId } = await params;
  const family = await serverGet<Family>(
    `/children/families/${encodeURIComponent(id)}`,
  );
  const child = family.children.find((c) => c._id === childId);
  if (!child) notFound();
  return (
    <>
      <Link href={`/children/families/${id}`} className="text-sm">
        ← Back to family
      </Link>
      <ChildForm family={family} child={child} />
    </>
  );
}
