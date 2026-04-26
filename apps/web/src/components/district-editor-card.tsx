"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { DistrictOption, OversightRegionOption } from "@/lib/types";

export function DistrictEditorCard({
  district,
  oversightRegions,
  canEdit,
  canChangeOversightRegion,
}: {
  district: DistrictOption;
  oversightRegions: OversightRegionOption[];
  canEdit: boolean;
  canChangeOversightRegion: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/districts/${district._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oversightRegion: formData.get("oversightRegion"),
          name: formData.get("name"),
          isActive: formData.get("isActive") === "active",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to update district");
      }

      setStatus("District updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update district");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface rounded-[28px] p-6">
      <p className="eyebrow">District</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{district.name}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {district.oversightRegion} · {district.branchCount} branches
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              district.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {district.isActive ? "active" : "inactive"}
          </span>
        </div>

        {canEdit ? (
          <form action={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
            {canChangeOversightRegion ? (
              <select
                name="oversightRegion"
                defaultValue={district.oversightRegion}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              >
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
                  name="oversightRegion"
                  value={district.oversightRegion}
                />
                <input
                  value={district.oversightRegion}
                  readOnly
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
                />
              </>
            )}
            <input
              name="name"
              defaultValue={district.name}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              required
            />
            <select
              name="isActive"
              defaultValue={district.isActive ? "active" : "inactive"}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
            >
              {saving ? "Saving..." : "Save district"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            You can view this district, but only district admin, national admin, or overall oversight admin can edit it.
          </p>
        )}

        {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
      </div>
    </section>
  );
}
