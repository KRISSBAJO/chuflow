"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
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
      router.push(createdHref(`/members/${result._id}`, result, "Member"));
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
    <form action={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {branches.length > 0 ? (
          <Field label="Branch" required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Branch">
            <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
            <input value="Current branch scope" readOnly disabled className="ui-input" />
          </Field>
        )}

        <Field label="Linked guest record" hint="Optional. Public member intake submits directly as a member without creating a guest first.">
          <select name="guestId" className="ui-input">
            <option value="">No guest record attached</option>
            {scopedGuests.map((guest) => (
              <option key={guest._id} value={guest._id}>
                {guest.firstName} {guest.lastName}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title">
          <select name="title" defaultValue="" className="ui-input">
            <option value="">No title selected</option>
            {MEMBER_TITLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First name" required>
          <input name="firstName" placeholder="First name" className="ui-input" required />
        </Field>
        <Field label="Last name" required>
          <input name="lastName" placeholder="Last name" className="ui-input" required />
        </Field>
        <Field label="Phone number" required>
          <input name="phone" placeholder="Phone number" className="ui-input" required />
        </Field>
        <Field label="Email" required>
          <input name="email" type="email" placeholder="name@example.com" className="ui-input" required />
        </Field>
        <Field label="Membership status">
          <select name="membershipStatus" defaultValue="active" className="ui-input">
            {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date joined church" hint="This date cannot be in the future.">
          <input name="dateJoinedChurch" type="date" max={getTodayDateString()} className="ui-input" />
        </Field>
      </div>

      <section className="rounded-2xl bg-[#f6f5f1] p-5">
        <h3 className="text-[15px] font-semibold text-[#111111]">Service unit placement</h3>
        <p className="mt-0.5 text-[13px] text-[#6b6b6b]">Link this member to a service unit in the selected branch.</p>
        <Field
          label="Service unit"
          className="mt-4"
          hint={
            scopedServiceUnits.length > 0
              ? "Only active service units from this branch appear here."
              : "Create service units first if you want members to pick from a branch unit list."
          }
        >
          <select name="serviceUnitId" className="ui-input">
            <option value="">No service unit assigned yet</option>
            {scopedServiceUnits.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {MEMBER_COURSE_GROUPS.map((group) => (
        <section key={group.key} className="rounded-2xl bg-[#f6f5f1] p-5">
          <h3 className="text-[15px] font-semibold text-[#111111]">{group.title}</h3>
          <p className="mt-0.5 text-[13px] text-[#6b6b6b]">{group.helperText}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={group.question} className="sm:col-span-2">
              <select name={group.statusName} defaultValue="no" className="ui-input">
                {YES_NO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date or year">
              <input name={group.dateName} type="date" max={getTodayDateString()} className="ui-input" />
            </Field>
            <Field label="Location">
              <input name={group.locationName} placeholder={`${group.title} location`} className="ui-input" />
            </Field>
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-[#f6f5f1] p-5">
        <h3 className="text-[15px] font-semibold text-[#111111]">Baptism</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Holy Ghost baptism">
            <select name="holySpiritBaptismStatus" defaultValue="no" className="ui-input">
              {YES_NO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Water baptism">
            <select name="waterBaptismStatus" defaultValue="no" className="ui-input">
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
        <textarea name="familyDetails" placeholder="Family details, dependants or pastoral notes" className="ui-input" />
      </Field>

      <div className="flex justify-end border-t border-black/[0.06] pt-5">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save member"}
        </Button>
      </div>
    </form>
  );
}
