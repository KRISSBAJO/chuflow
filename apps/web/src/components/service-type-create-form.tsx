"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary } from "@/lib/types";

export function ServiceTypeCreateForm({
  branches,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/service-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          name: formData.get("name"),
          key: formData.get("key") || undefined,
          isActive: formData.get("isActive") === "on",
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create service type");
      }

      toast.success("Service type created", {
        description: "Attendance forms can now use this type as a dropdown option.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create service type";
      toast.error("Service type not created", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[24px] bg-white p-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-950">Create service type</h3>
        <p className="text-sm leading-6 text-slate-500">
          Use managed service types so attendance and public forms stay clean and consistent.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              name="branchId"
              defaultValue={defaultBranchId || ""}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              required
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
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Display name</span>
          <input
            name="name"
            placeholder="Sunday Service"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Key</span>
          <input
            name="key"
            placeholder="sunday_service"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <p className="text-xs text-slate-500">
            Leave blank and it will be generated automatically from the name.
          </p>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
        Active service type
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          placeholder="Optional description or when this type is used"
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Creating..." : "Create service type"}
      </button>
    </form>
  );
}
