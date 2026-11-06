import Link from "next/link";
import { serverGet } from "@/lib/server-api";
import { ChildrenSessionConsole } from "@/components/children/session-console";
import type { ChildSession } from "@/lib/children";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serverGet<ChildSession>(
    `/children/sessions/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <Link href="/children" className="text-sm">
        ← Back to children’s workspace
      </Link>
      <ChildrenSessionConsole initial={data} />
    </>
  );
}
