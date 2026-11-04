"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardHeader, Field } from "@/components/ui/ui";
import { MemberServiceGroups } from "@/components/member-service-groups";
import { memberGroupIds } from "@/lib/member-service-groups";
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
    serviceUnitIds?: { _id?: string; name?: string }[];
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

  const selectedServiceUnitIds =
    Array.isArray(member.serviceUnitIds) || member.serviceUnitId
      ? memberGroupIds(member)
      : scopedServiceUnits
          .filter((unit) => unit.name === member.serviceUnitInterest)
          .map((unit) => unit._id);

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
          serviceUnitIds: formData.getAll("serviceUnitIds"),
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
    <Card className="p-6 sm:p-7">
      <CardHeader
        label="Edit profile"
        title="Update member details"
        description={
          member.branchId?.name
            ? `This record belongs to ${member.branchId.name}. Keep milestones and placement up to date.`
            : "This record stays inside its current branch. Keep milestones and placement up to date."
        }
      />
      <form action={handleSubmit} className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <select
              name="title"
              defaultValue={member.title || ""}
              className="ui-input"
            >
              <option value="">No title selected</option>
              {MEMBER_TITLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="First name" required>
            <input
              name="firstName"
              defaultValue={member.firstName}
              required
              className="ui-input"
            />
          </Field>
          <Field label="Last name" required>
            <input
              name="lastName"
              defaultValue={member.lastName}
              required
              className="ui-input"
            />
          </Field>
          <Field label="Phone number">
            <input
              name="phone"
              defaultValue={member.phone || ""}
              className="ui-input"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={member.email || ""}
              className="ui-input"
            />
          </Field>
          <Field
            label="Membership status"
            hint={`Current status: ${formatMembershipStatus(member.membershipStatus)}`}
          >
            <select
              name="membershipStatus"
              defaultValue={member.membershipStatus}
              className="ui-input"
            >
              {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date joined church">
            <input
              name="dateJoinedChurch"
              type="date"
              max={getTodayDateString()}
              defaultValue={member.dateJoinedChurch || ""}
              className="ui-input"
            />
          </Field>
        </div>

        <section className="rounded-2xl bg-[#f6f5f1] p-5">
          <h3 className="text-[15px] font-semibold text-[#111111]">
            Service group membership
          </h3>
          <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
            Choose every service group this member belongs to in this branch.
          </p>
          <MemberServiceGroups
            key={selectedServiceUnitIds.join(",")}
            units={scopedServiceUnits}
            selected={selectedServiceUnitIds}
          />
        </section>

        {MEMBER_COURSE_GROUPS.map((group) => {
          const values = member as unknown as Record<
            string,
            string | undefined
          >;

          return (
            <section key={group.key} className="rounded-2xl bg-[#f6f5f1] p-5">
              <h3 className="text-[15px] font-semibold text-[#111111]">
                {group.title}
              </h3>
              <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
                {group.helperText}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label={group.question}>
                  <select
                    name={group.statusName}
                    defaultValue={normalizeYesNoValue(values[group.statusName])}
                    className="ui-input"
                  >
                    <option value="">Select one</option>
                    {YES_NO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date or year">
                  <input
                    name={group.dateName}
                    type="date"
                    max={getTodayDateString()}
                    defaultValue={values[group.dateName] || ""}
                    className="ui-input"
                  />
                </Field>
                <Field label="Location">
                  <input
                    name={group.locationName}
                    defaultValue={values[group.locationName] || ""}
                    placeholder={`${group.title} location`}
                    className="ui-input"
                  />
                </Field>
              </div>
            </section>
          );
        })}

        <section className="rounded-2xl bg-[#f6f5f1] p-5">
          <h3 className="text-[15px] font-semibold text-[#111111]">Baptism</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Holy Ghost baptism">
              <select
                name="holySpiritBaptismStatus"
                defaultValue={normalizeYesNoValue(
                  member.holySpiritBaptismStatus,
                )}
                className="ui-input"
              >
                <option value="">Select one</option>
                {YES_NO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Water baptism">
              <select
                name="waterBaptismStatus"
                defaultValue={normalizeYesNoValue(member.waterBaptismStatus)}
                className="ui-input"
              >
                <option value="">Select one</option>
                {YES_NO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <Field label="Family details">
          <textarea
            name="familyDetails"
            defaultValue={member.familyDetails || ""}
            placeholder="Family details, dependants or pastoral notes"
            className="ui-input"
          />
        </Field>

        <div className="flex justify-end border-t border-black/[0.06] pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save member profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
