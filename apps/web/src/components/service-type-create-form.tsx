"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary } from "@/lib/types";
import { Button, Field } from "@/components/ui/ui";

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
    <form action={handleSubmit}>
      <div>
        <h3 className="lp-heading text-[18px]">Create service type</h3>
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          Managed service types keep attendance and public forms clean and consistent.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <Field label="Branch" required>
            <select name="branchId" defaultValue={defaultBranchId || ""} className="ui-input" required>
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <Field label="Display name" required>
          <input name="name" placeholder="Sunday Service" className="ui-input" required />
        </Field>

        <Field label="Key" hint="Leave blank to generate it from the name.">
          <input name="key" placeholder="sunday_service" className="ui-input" />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[14px] text-[#55534e]">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
        Active service type
      </label>

      <Field label="Notes" className="mt-4">
        <textarea name="notes" placeholder="Optional description or when this type is used" className="ui-input" />
      </Field>

      <Button type="submit" disabled={loading} className="mt-5">
        {loading ? "Creating..." : "Create service type"}
      </Button>
    </form>
  );
}
