"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { OfferingTypeSummary } from "@/lib/types";

export function OfferingTypeManagementCard({
  offeringTypes,
}: {
  offeringTypes: OfferingTypeSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function createOfferingType(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/finance/offering-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          key: formData.get("key") || undefined,
          description: formData.get("description") || undefined,
          isActive: formData.get("isActive") === "on",
          sortOrder: Number(formData.get("sortOrder") || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create offering type");
      }

      toast.success("Offering type created", {
        description: "All branches can now use this type for finance entries.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Offering type not created", {
        description:
          error instanceof Error ? error.message : "Unable to create offering type",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateOfferingType(id: string, formData: FormData) {
    setLoadingId(id);

    try {
      const response = await fetch(`${API_URL}/finance/offering-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get(`name-${id}`),
          key: formData.get(`key-${id}`) || undefined,
          description: formData.get(`description-${id}`) || undefined,
          isActive: formData.get(`isActive-${id}`) === "on",
          sortOrder: Number(formData.get(`sortOrder-${id}`) || 0),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update offering type");
      }

      toast.success("Offering type updated", {
        description: "The global offering type setup is now up to date.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Offering type update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update offering type",
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Default offering types</p>
        <h3 className="text-lg font-semibold text-slate-950">Global setup</h3>
        <p className="text-sm leading-6 text-slate-500">
          Site admin controls the shared offering types every branch uses.
        </p>
      </div>

      <form action={createOfferingType} className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          name="name"
          placeholder="Offering type name"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          required
        />
        <input
          name="key"
          placeholder="Optional key"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <textarea
          name="description"
          placeholder="Optional description"
          className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
          Active immediately
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
        >
          {loading ? "Creating..." : "Create offering type"}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {offeringTypes.map((offeringType) => (
          <details key={offeringType._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{offeringType.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {offeringType.key}
                    {offeringType.isSeeded ? " · seeded default" : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    offeringType.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {offeringType.isActive ? "active" : "inactive"}
                </span>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => updateOfferingType(offeringType._id, formData)}
                className="grid gap-3"
              >
                <input
                  name={`name-${offeringType._id}`}
                  defaultValue={offeringType.name}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <input
                  name={`key-${offeringType._id}`}
                  defaultValue={offeringType.key}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <input
                  name={`sortOrder-${offeringType._id}`}
                  type="number"
                  defaultValue={offeringType.sortOrder}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <textarea
                  name={`description-${offeringType._id}`}
                  defaultValue={offeringType.description || ""}
                  className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`isActive-${offeringType._id}`}
                    defaultChecked={offeringType.isActive}
                    className="h-4 w-4"
                  />
                  Active offering type
                </label>
                <button
                  type="submit"
                  disabled={loadingId === offeringType._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === offeringType._id ? "Saving..." : "Update offering type"}
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
