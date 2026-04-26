"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import {
  formatMembershipStatus,
  MEMBER_TITLE_OPTIONS,
  MEMBER_COURSE_GROUPS,
  MEMBERSHIP_STATUS_OPTIONS,
  normalizeYesNoValue,
  YES_NO_OPTIONS,
} from "@/lib/member-form-options";
import type { ServiceUnitSummary } from "@/lib/types";

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

export function MemberProfileForm({
  member,
  defaultBranchId,
  serviceUnits,
}: {
  member: {
    _id: string;
    title?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    membershipStatus: string;
    dateJoinedChurch?: string;
    believerFoundationClassStatus?: string;
    believerFoundationClassDate?: string;
    believerFoundationClassLocation?: string;
    bccStatus?: string;
    bccDate?: string;
    bccLocation?: string;
    lccStatus?: string;
    lccDate?: string;
    lccLocation?: string;
    lcdStatus?: string;
    lcdDate?: string;
    lcdLocation?: string;
    holySpiritBaptismStatus?: string;
    waterBaptismStatus?: string;
    serviceUnitInterest?: string;
    serviceUnitId?: { _id?: string; name?: string };
    familyDetails?: string;
    branchId?: { _id?: string; name?: string };
  };
  defaultBranchId?: string;
  serviceUnits: ServiceUnitSummary[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const branchId = member.branchId?._id || defaultBranchId;

  const scopedServiceUnits = useMemo(
    () =>
      serviceUnits.filter((unit) =>
        branchId ? getBranchId(unit.branchId) === branchId : true,
      ),
    [branchId, serviceUnits],
  );

  const selectedServiceUnitId =
    member.serviceUnitId?._id ||
    scopedServiceUnits.find((unit) => unit.name === member.serviceUnitInterest)?._id ||
    "";

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/members/${member._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId,
          title: formData.get("title") || undefined,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email") || undefined,
          phone: formData.get("phone") || undefined,
          membershipStatus: formData.get("membershipStatus") || undefined,
          dateJoinedChurch: formData.get("dateJoinedChurch") || undefined,
          serviceUnitId: formData.get("serviceUnitId") || undefined,
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
          familyDetails: formData.get("familyDetails") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update member");
      }

      toast.success("Member profile updated", {
        description: "The member record has been refreshed successfully.",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update member";
      toast.error("Member update failed", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface rounded-[32px] p-6">
      <p className="eyebrow">Profile Edit</p>
      <div className="mt-3 flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-slate-950">
          Update member details
        </h2>
        <p className="text-sm leading-6 text-slate-500">
          {member.branchId?.name
            ? `This record is isolated to ${member.branchId.name}.`
            : "This record stays inside its current branch scope."}{" "}
          Replace raw milestone codes with clean church-admin data.
        </p>
      </div>
      <form action={handleSubmit} className="mt-5 rounded-[28px] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <select
              name="title"
              defaultValue={member.title || ""}
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
              defaultValue={member.firstName}
              required
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Last name</span>
            <input
              name="lastName"
              defaultValue={member.lastName}
              required
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Phone number</span>
            <input
              name="phone"
              defaultValue={member.phone || ""}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={member.email || ""}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Membership status
            </span>
            <select
              name="membershipStatus"
              defaultValue={member.membershipStatus}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Current status: {formatMembershipStatus(member.membershipStatus)}
            </p>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Date joined church
            </span>
            <input
              name="dateJoinedChurch"
              type="date"
              max={getTodayDateString()}
              defaultValue={member.dateJoinedChurch || ""}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>
        </div>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              Service Unit Placement
            </h4>
            <p className="text-sm text-slate-500">
              Keep this member attached to the right branch service unit.
            </p>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-700">Service unit</span>
            <select
              name="serviceUnitId"
              defaultValue={selectedServiceUnitId}
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
              {member.serviceUnitInterest
                ? `Previously recorded interest: ${member.serviceUnitInterest}.`
                : "Assign a real service unit instead of storing free-text interest."}
            </p>
          </label>
        </section>

        <div className="mt-6 space-y-4">
          {MEMBER_COURSE_GROUPS.map((group) => {
            const values = member as unknown as Record<string, string | undefined>;

            return (
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
                      defaultValue={normalizeYesNoValue(values[group.statusName])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    >
                      <option value="">Select one</option>
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
                      defaultValue={values[group.dateName] || ""}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Location
                    </span>
                    <input
                      name={group.locationName}
                      defaultValue={values[group.locationName] || ""}
                      placeholder={`${group.title} location`}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Holy Ghost baptism
              </span>
              <select
                name="holySpiritBaptismStatus"
                defaultValue={normalizeYesNoValue(member.holySpiritBaptismStatus)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              >
                <option value="">Select one</option>
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
                defaultValue={normalizeYesNoValue(member.waterBaptismStatus)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              >
                <option value="">Select one</option>
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
            defaultValue={member.familyDetails || ""}
            placeholder="Family details, dependants, or pastoral notes"
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          {loading ? "Saving..." : "Save member profile"}
        </button>
      </form>
    </section>
  );
}
