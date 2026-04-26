"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, ServiceTypeSummary } from "@/lib/types";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getBranchName(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?.name;
}

export function ServiceTypeManagementList({
  serviceTypes,
  branches,
  currentUserRole,
}: {
  serviceTypes: ServiceTypeSummary[];
  branches: BranchSummary[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(serviceTypeId: string, formData: FormData) {
    setLoadingId(serviceTypeId);

    try {
      const response = await fetch(`${API_URL}/service-types/${serviceTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get(`branchId-${serviceTypeId}`) as string) || undefined,
          name: formData.get(`name-${serviceTypeId}`),
          key: formData.get(`key-${serviceTypeId}`) || undefined,
          isActive: formData.get(`isActive-${serviceTypeId}`) === "on",
          notes: formData.get(`notes-${serviceTypeId}`) || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update service type");
      }

      toast.success("Service type updated", {
        description: "Attendance dropdowns will use the latest version immediately.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update service type";
      toast.error("Service type update failed", {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (serviceTypes.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
        No service types exist yet. Create your first one so attendance can use a clean dropdown.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {serviceTypes.map((serviceType) => {
        const branchId = getBranchId(serviceType.branchId) || "";

        return (
          <details key={serviceType._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{serviceType.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {serviceType.key} · {getBranchName(serviceType.branchId) || "Branch scope"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    serviceType.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {serviceType.isActive ? "active" : "inactive"}
                </span>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form
                action={(formData) => handleSubmit(serviceType._id, formData)}
                className="grid gap-3 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Branch</span>
                    <select
                      name={`branchId-${serviceType._id}`}
                      defaultValue={branchId}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <input
                    type="hidden"
                    name={`branchId-${serviceType._id}`}
                    value={branchId}
                  />
                )}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Display name</span>
                  <input
                    name={`name-${serviceType._id}`}
                    defaultValue={serviceType.name}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Key</span>
                  <input
                    name={`key-${serviceType._id}`}
                    defaultValue={serviceType.key}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Notes</span>
                  <textarea
                    name={`notes-${serviceType._id}`}
                    defaultValue={serviceType.notes || ""}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name={`isActive-${serviceType._id}`}
                    defaultChecked={serviceType.isActive}
                    className="h-4 w-4"
                  />
                  Active service type
                </label>

                <button
                  type="submit"
                  disabled={loadingId === serviceType._id}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                >
                  {loadingId === serviceType._id ? "Saving..." : "Update service type"}
                </button>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
