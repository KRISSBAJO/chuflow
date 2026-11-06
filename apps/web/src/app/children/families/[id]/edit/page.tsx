import Link from "next/link";
import { serverGet } from "@/lib/server-api";
import { FamilyForm } from "@/components/children/forms";
import type { Family, ChildrenOptions } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [family, options] = await Promise.all([
    serverGet<Family>(`/children/families/${encodeURIComponent(id)}`),
    serverGet<ChildrenOptions>("/children/options"),
  ]);
  return (
    <>
      <Link href={`/children/families/${id}`} className="text-sm">
        ← Back to family
      </Link>
      <FamilyForm family={family} options={options} />
    </>
  );
}
