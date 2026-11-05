import { notFound } from "next/navigation";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { HierarchyWorkspace } from "@/components/hierarchy/workspace";
import type { HierarchyOverview } from "@/lib/hierarchy";

export default async function Page({ params, searchParams }: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ districtId?: string }>;
}) {
  await requireServerRole("/hierarchy");
  const { unitId } = await params;
  const { districtId } = await searchParams;
  const data = await serverGet<HierarchyOverview>(`/hierarchy${districtId ? "?districtId=" + encodeURIComponent(districtId) : ""}`);
  if (!data.units.some((unit) => unit._id === unitId)) notFound();
  return <Shell><HierarchyWorkspace key={unitId} data={data} unitId={unitId} /></Shell>;
}
