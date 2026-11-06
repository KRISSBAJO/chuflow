import Link from "next/link";
import { serverGet } from "@/lib/server-api";
import { ChildForm } from "@/components/children/forms";
import type { Family } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const family = await serverGet<Family>(
    `/children/families/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <Link href={`/children/families/${id}`} className="text-sm">
        ← Back to family
      </Link>
      <ChildForm family={family} />
    </>
  );
}
