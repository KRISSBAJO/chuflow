"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function GuestCreateForm({
  branches,
  defaultBranchId,
  users = [],
  serviceTypes = [],
  onSuccess,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
  users?: UserSummary[];
  serviceTypes?: ServiceTypeSummary[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const branchMap = new Map(branches.map((branch) => [branch._id, branch.name]));
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || (branches.length === 1 ? branches[0]?._id : "") || "",
  );
  const selectedBranch =
    branches.find((branch) => branch._id === selectedBranchId) ||
    (branches.length === 1 ? branches[0] : undefined);
  const assignableUsers = users.filter((user) =>
    ["branch_admin", "resident_pastor", "associate_pastor", "follow_up"].includes(user.role),
  );
  const filteredAssignableUsers = useMemo(
    () =>
      assignableUsers.filter((user) =>
        selectedBranchId ? !user.branchId || user.branchId === selectedBranchId : true,
      ),
    [assignableUsers, selectedBranchId],
  );
  const filteredServiceTypes = useMemo(
    () =>
      serviceTypes.filter((serviceType) =>
        selectedBranchId ? getBranchId(serviceType.branchId) === selectedBranchId : true,
      ),
    [selectedBranchId, serviceTypes],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: formData.get("branchId") || defaultBranchId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          invitedBy: formData.get("invitedBy"),
          heardAboutChurch: formData.get("heardAboutChurch"),
          prayerRequest: formData.get("prayerRequest"),
          assignedFollowUpUserId: formData.get("assignedFollowUpUserId") || undefined,
          serviceType: formData.get("serviceType"),
          visitDate: new Date().toISOString(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create guest");
      }

      toast.success("Guest saved", {
        description: "The guest record is now in the registry and ready for follow-up.",
      });
      onSuccess?.();
      router.refresh();
    } catch (error) {
      toast.error("Guest not saved", {
        description: error instanceof Error ? error.message : "Unable to create guest",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[22px] bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-950">Register guest</h3>
      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {branches.length > 1 ? (
          <select
            name="branchId"
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            required
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : selectedBranch ? (
          <>
            <input type="hidden" name="branchId" value={selectedBranch._id} />
            <input value={selectedBranch.name} readOnly className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none" />
          </>
        ) : (
          <>
            <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
            <input value="Current branch scope" readOnly className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none" />
          </>
        )}
        {filteredServiceTypes.length > 0 ? (
          <select
            name="serviceType"
            defaultValue={filteredServiceTypes[0]?.name || ""}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            required
          >
            <option value="">Select service type</option>
            {filteredServiceTypes.map((serviceType) => (
              <option key={serviceType._id} value={serviceType.name}>
                {serviceType.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="serviceType"
            placeholder="Service type"
            defaultValue="Sunday service"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            required
          />
        )}
        <input name="firstName" placeholder="First name" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <input name="lastName" placeholder="Last name" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <input name="phone" placeholder="Phone number" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" required />
        <input name="email" placeholder="Email" type="email" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
        <input name="invitedBy" placeholder="Invited by" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
        <input name="heardAboutChurch" placeholder="How they heard" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" />
        {filteredAssignableUsers.length > 0 ? (
          <select
            name="assignedFollowUpUserId"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          >
            <option value="">Leave unassigned</option>
            {filteredAssignableUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {user.firstName} {user.lastName}
                {user.branchId ? ` · ${branchMap.get(user.branchId) || "Assigned branch"}` : ""}
              </option>
            ))}
          </select>
        ) : null}
        <textarea name="prayerRequest" placeholder="Prayer request" className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2" />
      </div>
      <button type="submit" disabled={loading} className="mt-4 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white">
        {loading ? "Saving..." : "Save guest"}
      </button>
    </form>
  );
}
