"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import {
  MEMBER_COURSE_GROUPS,
  MEMBER_TITLE_OPTIONS,
  MEMBERSHIP_STATUS_OPTIONS,
  YES_NO_OPTIONS,
} from "@/lib/member-form-options";
import type { BranchSummary, GuestListItem, ServiceUnitSummary } from "@/lib/types";

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBranchId(value: ServiceUnitSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

export function MemberCreateForm({
  branches,
  guests,
  serviceUnits,
  defaultBranchId,
}: {
  branches: BranchSummary[];
  guests: GuestListItem[];
  serviceUnits: ServiceUnitSummary[];
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const scopedServiceUnits = useMemo(
    () =>
      serviceUnits.filter((unit) =>
        selectedBranchId ? getBranchId(unit.branchId) === selectedBranchId : true,
      ),
    [selectedBranchId, serviceUnits],
  );

  const scopedGuests = useMemo(
    () =>
      guests.filter((guest) =>
        selectedBranchId ? guest.branchId?._id === selectedBranchId : true,
      ),
    [guests, selectedBranchId],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const payload = {
        branchId: (formData.get("branchId") as string) || defaultBranchId,
        guestId: (formData.get("guestId") as string) || undefined,
        title: formData.get("title") || undefined,
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        phone: formData.get("phone") || undefined,
        email: formData.get("email") || undefined,
        familyDetails: formData.get("familyDetails") || undefined,
        membershipStatus: formData.get("membershipStatus"),
        dateJoinedChurch: formData.get("dateJoinedChurch") || undefined,
        serviceUnitId: (formData.get("serviceUnitId") as string) || undefined,
        believerFoundationClassStatus:
          formData.get("believerFoundationClassStatus") || undefined,
        believerFoundationClassDate:
          formData.get("believerFoundationClassDate") || undefined,
        believerFoundationClassLocation:
          formData.get("believerFoundationClassLocation") || undefined,
        bccStatus: formData.get("bccStatus") || undefined,
        bccDate: formData.get("bccDate") || undefined,
        bccLocation: formData.get("bccLocation") || undefined,
        lccStatus: formData.get("lccStatus") || undefined,
        lccDate: formData.get("lccDate") || undefined,
        lccLocation: formData.get("lccLocation") || undefined,
        lcdStatus: formData.get("lcdStatus") || undefined,
        lcdDate: formData.get("lcdDate") || undefined,
        lcdLocation: formData.get("lcdLocation") || undefined,
        holySpiritBaptismStatus:
          formData.get("holySpiritBaptismStatus") || undefined,
        waterBaptismStatus: formData.get("waterBaptismStatus") || undefined,
      };

      const response = await fetch(`${API_URL}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to create member");
      }

      toast.success("Member saved", {
        description: "The member profile has been created in the selected branch.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create member";
      toast.error("Member not saved", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-slate-950">Add member</h3>
        <p className="text-sm leading-6 text-slate-500">
          Direct member intake. No guest record is required. Use the optional
          guest selector only when you are attaching this member to an existing
          guest journey.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {branches.length > 0 ? (
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Branch</span>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
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
          <>
            <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Branch</span>
              <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
                Current branch scope
              </div>
            </div>
          </>
        )}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Optional guest record
          </span>
          <select
            name="guestId"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">No guest record attached</option>
            {scopedGuests.map((guest) => (
              <option key={guest._id} value={guest._id}>
                {guest.firstName} {guest.lastName}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Public member intake should submit directly as a member without first
            creating a guest.
          </p>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <select
            name="title"
            defaultValue=""
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="">No title selected</option>
            {MEMBER_TITLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">First name</span>
          <input
            name="firstName"
            placeholder="First name"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Last name</span>
          <input
            name="lastName"
            placeholder="Last name"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Phone number</span>
          <input
            name="phone"
            placeholder="Phone number"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            placeholder="Email"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Membership status
          </span>
          <select
            name="membershipStatus"
            defaultValue="active"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Date joined church
          </span>
          <input
            name="dateJoinedChurch"
            type="date"
            max={getTodayDateString()}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <p className="text-xs text-slate-500">
            This date cannot be in the future.
          </p>
        </label>
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            Service Unit Placement
          </h4>
          <p className="text-sm text-slate-500">
            Link this member to a real service unit in the selected branch.
          </p>
        </div>
        <label className="mt-4 block space-y-2">
          <span className="text-sm font-medium text-slate-700">Service unit</span>
          <select
            name="serviceUnitId"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
          >
            <option value="">No service unit assigned yet</option>
            {scopedServiceUnits.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {scopedServiceUnits.length > 0
              ? "Only active service units from this branch appear here."
              : "Create service units first if you want members to pick from a branch unit list."}
          </p>
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {MEMBER_COURSE_GROUPS.map((group) => (
          <section
            key={group.key}
            className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group.title}
              </h4>
              <p className="text-sm text-slate-500">{group.helperText}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  {group.question}
                </span>
                <select
                  name={group.statusName}
                  defaultValue="no"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                >
                  {YES_NO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Date or year
                </span>
                <input
                  name={group.dateName}
                  type="date"
                  max={getTodayDateString()}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Location
                </span>
                <input
                  name={group.locationName}
                  placeholder={`${group.title} location`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                />
              </label>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Holy Ghost baptism
            </span>
            <select
              name="holySpiritBaptismStatus"
              defaultValue="no"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
            >
              {YES_NO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Water baptism
            </span>
            <select
              name="waterBaptismStatus"
              defaultValue="no"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
            >
              {YES_NO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label className="mt-6 block space-y-2">
        <span className="text-sm font-medium text-slate-700">Family details</span>
        <textarea
          name="familyDetails"
          placeholder="Family details, dependants, or pastoral notes"
          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Saving..." : "Save member"}
      </button>
    </form>
  );
}
