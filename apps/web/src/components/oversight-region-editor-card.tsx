"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { OversightRegionOption } from "@/lib/types";

export function OversightRegionEditorCard({
  region,
  canEdit,
}: {
  region: OversightRegionOption;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/oversight-regions/${region._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          isActive: formData.get("isActive") === "active",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to update national area");
      }

      setStatus("National area updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update national area",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface rounded-[28px] p-6">
      <p className="eyebrow">National Area</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{region.name}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {region.districtCount} districts · {region.branchCount} branches
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
              region.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {region.isActive ? "active" : "inactive"}
          </span>
        </div>

        {canEdit ? (
          <form action={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              name="name"
              defaultValue={region.name}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
              required
            />
            <select
              name="isActive"
              defaultValue={region.isActive ? "active" : "inactive"}
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
              {saving ? "Saving..." : "Save national area"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            You can view this national area, but only national admin or overall oversight admin can edit it.
          </p>
        )}

        {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
      </div>
    </section>
  );
}
