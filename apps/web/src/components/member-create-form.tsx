"use client";
import { savedToastId } from "@/lib/action-feedback";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { MemberServiceGroups } from "@/components/member-service-groups";
import { API_URL } from "@/lib/api";
import {
  MEMBER_COURSE_GROUPS,
  MEMBER_TITLE_OPTIONS,
  MEMBERSHIP_STATUS_OPTIONS,
  useMemberFormLabels,
  YES_NO_OPTIONS,
} from "@/lib/member-form-options";
import type {
  BranchSummary,
  GuestListItem,
  ServiceUnitSummary,
} from "@/lib/types";

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
  const t = useTranslations("org.memberForm");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
  const [loading, setLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    defaultBranchId || branches[0]?._id || "",
  );

  const scopedServiceUnits = useMemo(
    () =>
      serviceUnits.filter((unit) =>
        selectedBranchId
          ? getBranchId(unit.branchId) === selectedBranchId
          : true,
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
      };

      const response = await fetch(`${API_URL}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("createdTitle"), {
        id: savedToastId(result),
        description: t("createdBody"),
      });
      router.push(
        createdHref(`/members/${result._id}`, result, t("entityName")),
      );
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("createError");
      toast.error(t("createFailed"), {
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
          <Field label={tCommon("branch")} required>
            <select
              name="branchId"
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">{tCommon("selectBranch")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={tCommon("branch")}>
            <input
              type="hidden"
              name="branchId"
              value={defaultBranchId ?? ""}
            />
            <input
              value={t("currentBranchScope")}
              readOnly
              disabled
              className="ui-input"
            />
          </Field>
        )}

        <Field label={t("linkedGuest")} hint={t("linkedGuestHint")}>
          <select name="guestId" className="ui-input">
            <option value="">{t("noGuest")}</option>
            {scopedGuests.map((guest) => (
              <option key={guest._id} value={guest._id}>
                {guest.firstName} {guest.lastName}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("title")}>
          <select name="title" defaultValue="" className="ui-input">
            <option value="">{t("noTitle")}</option>
            {MEMBER_TITLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {labels.title(option.value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tCommon("firstName")} required>
          <input
            name="firstName"
            placeholder={tCommon("firstName")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={tCommon("lastName")} required>
          <input
            name="lastName"
            placeholder={tCommon("lastName")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("phoneNumber")} required>
          <input
            name="phone"
            placeholder={t("phoneNumber")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={tCommon("email")} required>
          <input
            name="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("membershipStatus")}>
          <select
            name="membershipStatus"
            defaultValue="active"
            className="ui-input"
          >
            {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {labels.membershipStatusOption(option.value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("dateJoined")} hint={t("dateJoinedHint")}>
          <input
            name="dateJoinedChurch"
            type="date"
            max={getTodayDateString()}
            className="ui-input"
          />
        </Field>
      </div>

      <section className="rounded-2xl bg-[#f6f5f1] p-5">
        <h3 className="text-[15px] font-semibold text-[#111111]">
          {t("serviceGroupsTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
          {t("createServiceGroupsHint")}
        </p>
        <MemberServiceGroups
          key={selectedBranchId}
          units={scopedServiceUnits}
        />
      </section>

      {MEMBER_COURSE_GROUPS.map((group) => {
        const course = labels.course(group);
        return (
          <section key={group.key} className="rounded-2xl bg-[#f6f5f1] p-5">
            <h3 className="text-[15px] font-semibold text-[#111111]">
              {course.title}
            </h3>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              {course.helperText}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={course.question} className="sm:col-span-2">
                <select
                  name={group.statusName}
                  defaultValue="no"
                  className="ui-input"
                >
                  {YES_NO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {labels.yesNo(option.value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("dateOrYear")}>
                <input
                  name={group.dateName}
                  type="date"
                  max={getTodayDateString()}
                  className="ui-input"
                />
              </Field>
              <Field label={t("location")}>
                <input
                  name={group.locationName}
                  placeholder={t("locationPlaceholder", {
                    course: course.title,
                  })}
                  className="ui-input"
                />
              </Field>
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl bg-[#f6f5f1] p-5">
        <h3 className="text-[15px] font-semibold text-[#111111]">
          {t("baptism")}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("holyGhostBaptism")}>
            <select
              name="holySpiritBaptismStatus"
              defaultValue="no"
              className="ui-input"
            >
              {YES_NO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {labels.yesNo(option.value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("waterBaptism")}>
            <select
              name="waterBaptismStatus"
              defaultValue="no"
              className="ui-input"
            >
              {YES_NO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {labels.yesNo(option.value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <Field label={t("familyDetails")}>
        <textarea
          name="familyDetails"
          placeholder={t("familyDetailsPlaceholder")}
          className="ui-input"
        />
      </Field>

      <div className="flex justify-end border-t border-black/[0.06] pt-5">
        <Button type="submit" disabled={loading}>
          {loading ? tCommon("saving") : t("saveMember")}
        </Button>
      </div>
    </form>
  );
}
