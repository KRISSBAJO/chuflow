"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    <section className="surface rounded-[28px] p-6">
      <p className="eyebrow">Hierarchy Catalog</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                National areas
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Create the national or oversight areas first, then attach
                districts and branches underneath them.
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
              {oversightRegions.length} regions
            </span>
          </div>

          {canCreateRegion ? (
            <form
              action={handleCreateRegion}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                name="regionName"
                placeholder="Create national area"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                required
              />
              <button
                type="submit"
                disabled={loading === "region"}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {loading === "region" ? "Creating..." : "Create"}
              </button>
            </form>
          ) : null}

          <div className="mt-4 space-y-2">
            {oversightRegions.length > 0 ? (
              oversightRegions.map((region) => (
                <Link
                  key={region._id}
                  href={`/structure/national/${region._id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{region.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {region.districtCount} districts · {region.branchCount} branches
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-600">
                    Open
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No oversight regions have been created yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Districts</h3>
              <p className="mt-1 text-sm text-slate-500">
                Districts sit inside a national area, and branches are created
                under the district you select.
              </p>
            </div>
            <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
              {districts.length} districts
            </span>
          </div>

          {canCreateDistrict ? (
            <form action={handleCreateDistrict} className="mt-4 grid gap-2">
              {isGlobalRole(currentUserRole) ? (
                <select
                  name="districtOversightRegion"
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
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
                    className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                  />
                </>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  name="districtName"
                  placeholder="Create district"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={loading === "district"}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {loading === "district" ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-4 space-y-2">
            {visibleDistricts.length > 0 ? (
              visibleDistricts.map((district) => (
                <Link
                  key={district._id}
                  href={`/structure/district/${district._id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{district.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {district.oversightRegion} · {district.branchCount} branches
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                    Open
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No districts are available in the selected national area yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
