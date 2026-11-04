"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icons";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { isGlobalRole } from "@/lib/permissions";
import type { DistrictOption, OversightRegionOption } from "@/lib/types";

export function HierarchyCatalogPanel({
  currentUserRole,
  defaultOversightRegion,
  oversightRegions,
  districts,
}: {
  currentUserRole: string;
  defaultOversightRegion?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"region" | "district" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState(
    defaultOversightRegion || oversightRegions[0]?.name || "",
  );
  const canCreateRegion = currentUserRole === "super_admin";
  const canCreateDistrict =
    currentUserRole === "super_admin" || currentUserRole === "national_admin";

  const visibleDistricts = useMemo(
    () =>
      districts.filter(
        (district) =>
          !selectedRegion || district.oversightRegion === selectedRegion,
      ),
    [districts, selectedRegion],
  );

  async function handleCreateRegion(formData: FormData) {
    setLoading("region");
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/oversight-regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("regionName"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create oversight region");
      }

      setStatus("Oversight region created successfully.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to create oversight region",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleCreateDistrict(formData: FormData) {
    setLoading("district");
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/districts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oversightRegion:
            formData.get("districtOversightRegion") || defaultOversightRegion,
          name: formData.get("districtName"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create district");
      }

      setStatus("District created successfully.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to create district",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="Hierarchy catalog"
        title="National areas and districts"
        description="Create national areas first, then attach districts and branches underneath them."
      />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                <Icon name="structure" className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="lp-heading text-[17px]">National areas</h3>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">
                  The top level of your structure. Districts and branches sit
                  underneath each area.
                </p>
              </div>
            </div>
            <Badge tone="flame">
              <span className="tabular-nums">{oversightRegions.length}</span> areas
            </Badge>
          </div>

          {canCreateRegion ? (
            <form
              action={handleCreateRegion}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                name="regionName"
                placeholder="New national area name"
                aria-label="New national area name"
                className="ui-input flex-1"
                required
              />
              <Button type="submit" icon="plus" disabled={loading === "region"}>
                {loading === "region" ? "Creating..." : "Create"}
              </Button>
            </form>
          ) : null}

          <div className="mt-4">
            {oversightRegions.length > 0 ? (
              <ul className="divide-y divide-black/[0.05]">
                {oversightRegions.map((region) => (
                  <li key={region._id}>
                    <Link
                      href={`/structure/national/${region._id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[#111111]">{region.name}</span>
                        <span className="block text-[13px] text-[#6b6b6b]">
                          <span className="tabular-nums">{region.districtCount}</span> districts ·{" "}
                          <span className="tabular-nums">{region.branchCount}</span> branches
                        </span>
                      </span>
                      <Icon
                        name="arrowRight"
                        className="h-4 w-4 text-[#8a8780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#111111]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="structure" title="No national areas yet">
                Create the first national area to start building your structure.
              </EmptyState>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.06] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                <Icon name="pin" className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="lp-heading text-[17px]">Districts</h3>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">
                  Districts sit inside a national area, and branches are created
                  under the district you select.
                </p>
              </div>
            </div>
            <Badge>
              <span className="tabular-nums">{districts.length}</span> districts
            </Badge>
          </div>

          {canCreateDistrict ? (
            <form action={handleCreateDistrict} className="mt-4 grid gap-2">
              {isGlobalRole(currentUserRole) ? (
                <select
                  name="districtOversightRegion"
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  aria-label="National area"
                  className="ui-input"
                  required
                >
                  <option value="">Select national area</option>
                  {oversightRegions.map((region) => (
                    <option key={region._id} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="hidden"
                    name="districtOversightRegion"
                    value={defaultOversightRegion || ""}
                  />
                  <input
                    value={defaultOversightRegion || "Current national area"}
                    readOnly
                    aria-label="National area"
                    className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
                  />
                </>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  name="districtName"
                  placeholder="New district name"
                  aria-label="New district name"
                  className="ui-input flex-1"
                  required
                />
                <Button type="submit" icon="plus" disabled={loading === "district"}>
                  {loading === "district" ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="mt-4">
            {visibleDistricts.length > 0 ? (
              <ul className="divide-y divide-black/[0.05]">
                {visibleDistricts.map((district) => (
                  <li key={district._id}>
                    <Link
                      href={`/structure/district/${district._id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[#111111]">{district.name}</span>
                        <span className="block text-[13px] text-[#6b6b6b]">
                          {district.oversightRegion} ·{" "}
                          <span className="tabular-nums">{district.branchCount}</span> branches
                        </span>
                      </span>
                      <Icon
                        name="arrowRight"
                        className="h-4 w-4 text-[#8a8780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#111111]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="pin" title="No districts here yet">
                No districts are available in the selected national area yet.
              </EmptyState>
            )}
          </div>
        </div>
      </div>

      {status ? (
        <p role="status" className="mt-5 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </Card>
  );
}
