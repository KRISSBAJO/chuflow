import { FilterPanel } from "@/components/filter-panel";
import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/ui";
import { HierarchyWorkspace } from "@/components/hierarchy/workspace";
import type { HierarchyOverview } from "@/lib/hierarchy";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ districtId?: string }>;
}) {
  await requireServerRole("/hierarchy");
  const { districtId } = await searchParams;
  const data = await serverGet<HierarchyOverview>(
    `/hierarchy${districtId ? "?districtId=" + encodeURIComponent(districtId) : ""}`,
  );
  return (
    <Shell>
      <PageHeader
        eyebrow="Church oversight"
        title="One church. Connected responsibilities."
        description="Every location remains a local church. District, zonal and area appointments add oversight to the headquarters resident pastor’s existing account."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/structure" className={buttonClass("secondary")}>
              National & district setup
            </Link>
            <Link
              href={
                data.context.homeBranchId
                  ? "/dashboard?branchId=" + data.context.homeBranchId
                  : "/dashboard"
              }
              className={buttonClass("secondary")}
            >
              My church
            </Link>
          </div>
        }
      />
      <FilterPanel><form className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 text-sm">
          District
          <select
            name="districtId"
            className="ui-input mt-2"
            defaultValue={data.selectedDistrictId || ""}
          >
            {data.districts.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} · {d.oversightRegion}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClass("secondary")}>Open district</button>
      </form></FilterPanel>
      <HierarchyWorkspace key={data.selectedDistrictId} data={data} />
    </Shell>
  );
}
