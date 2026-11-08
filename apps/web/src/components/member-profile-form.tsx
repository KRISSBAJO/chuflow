"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Field,
  buttonClass,
} from "@/components/ui/ui";
import { MemberServiceGroups } from "@/components/member-service-groups";
import { memberGroupIds } from "@/lib/member-service-groups";
import { memberSectionPayload } from "@/lib/member-section";
import { useMemberFields } from "@/components/member-custom-fields";
import { API_URL } from "@/lib/api";
import {
  MEMBER_TITLE_OPTIONS,
  MEMBER_COURSE_GROUPS,
  MEMBERSHIP_STATUS_OPTIONS,
  normalizeYesNoValue,
  useMemberFormLabels,
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
  section = "all",
  returnHref,
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
  section?: "all" | "profile" | "growth" | "groups";
  returnHref?: string;
}) {
  const router = useRouter();
  const { form: definition } = useMemberFields();
  const visible = (key: string) => !definition?.hiddenStaff.includes(key);
  const tw = useTranslations("workspace");
  const t = useTranslations("org.memberForm");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
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
        body: JSON.stringify(memberSectionPayload(formData, section)),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updatedTitle"), {
        description: t("updatedBody"),
      });
      if (returnHref) router.replace(returnHref, { scroll: false });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("updateError");
      toast.error(t("updateFailed"), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <CardHeader
        label={tw("edit")}
        title={section === "all" ? t("editTitle") : tw(section)}
        description={
          member.branchId?.name
            ? t("editDescriptionBranch", { branch: member.branchId.name })
            : t("editDescription")
        }
      />
      <form action={handleSubmit} className="mt-6 space-y-5">
        {(section === "all" || section === "profile") && (
          <div className="grid gap-4 md:grid-cols-2">
            {visible("title") ? <Field label={t("title")}>
              <select
                name="title"
                defaultValue={member.title || ""}
                className="ui-input"
              >
                <option value="">{t("noTitle")}</option>
                {MEMBER_TITLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {labels.title(option.value)}
                  </option>
                ))}
              </select>
            </Field> : null}
            <Field label={tCommon("firstName")} required>
              <input
                name="firstName"
                defaultValue={member.firstName}
                required
                className="ui-input"
              />
            </Field>
            <Field label={tCommon("lastName")} required>
              <input
                name="lastName"
                defaultValue={member.lastName}
                required
                className="ui-input"
              />
            </Field>
            {visible("phone") ? <Field label={t("phoneNumber")}>
              <input
                name="phone"
                defaultValue={member.phone || ""}
                className="ui-input"
              />
            </Field> : null}
            {visible("email") ? <Field label={tCommon("email")}>
              <input
                name="email"
                type="email"
                defaultValue={member.email || ""}
                className="ui-input"
              />
            </Field> : null}
            <Field
              label={t("membershipStatus")}
              hint={t("currentStatus", {
                status: labels.membershipStatus(member.membershipStatus),
              })}
            >
              <select
                name="membershipStatus"
                defaultValue={member.membershipStatus}
                className="ui-input"
              >
                {MEMBERSHIP_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {labels.membershipStatusOption(option.value)}
                  </option>
                ))}
              </select>
            </Field>
            {visible("dateJoinedChurch") ? <Field label={t("dateJoined")}>
              <input
                name="dateJoinedChurch"
                type="date"
                max={getTodayDateString()}
                defaultValue={member.dateJoinedChurch || ""}
                className="ui-input"
              />
            </Field> : null}
          </div>
        )}

        {(section === "all" || section === "groups") && (
          <section className="rounded-2xl bg-[#f6f5f1] p-5">
            <h3 className="text-[15px] font-semibold text-[#111111]">
              {t("serviceGroupsTitle")}
            </h3>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              {t("profileServiceGroupsHint")}
            </p>
            <MemberServiceGroups
              key={selectedServiceUnitIds.join(",")}
              units={scopedServiceUnits}
              selected={selectedServiceUnitIds}
            />
          </section>
        )}

        {visible("formation") && (section === "all" || section === "growth") && (
          <>
            {MEMBER_COURSE_GROUPS.map((group) => {
              const values = member as unknown as Record<
                string,
                string | undefined
              >;
              const course = labels.course(group);

              return (
                <section
                  key={group.key}
                  className="rounded-2xl bg-[#f6f5f1] p-5"
                >
                  <h3 className="text-[15px] font-semibold text-[#111111]">
                    {course.title}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
                    {course.helperText}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Field label={course.question}>
                      <select
                        name={group.statusName}
                        defaultValue={normalizeYesNoValue(
                          values[group.statusName],
                        )}
                        className="ui-input"
                      >
                        <option value="">{t("selectOne")}</option>
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
                        defaultValue={values[group.dateName] || ""}
                        className="ui-input"
                      />
                    </Field>
                    <Field label={t("location")}>
                      <input
                        name={group.locationName}
                        defaultValue={values[group.locationName] || ""}
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
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label={t("holyGhostBaptism")}>
                  <select
                    name="holySpiritBaptismStatus"
                    defaultValue={normalizeYesNoValue(
                      member.holySpiritBaptismStatus,
                    )}
                    className="ui-input"
                  >
                    <option value="">{t("selectOne")}</option>
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
                    defaultValue={normalizeYesNoValue(
                      member.waterBaptismStatus,
                    )}
                    className="ui-input"
                  >
                    <option value="">{t("selectOne")}</option>
                    {YES_NO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {labels.yesNo(option.value)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
          </>
        )}
        {visible("familyDetails") && (section === "all" || section === "profile") && (
          <Field label={t("familyDetails")}>
            <textarea
              name="familyDetails"
              defaultValue={member.familyDetails || ""}
              placeholder={t("familyDetailsPlaceholder")}
              className="ui-input"
            />
          </Field>
        )}

        <div className="flex gap-3 justify-end border-t border-black/[0.06] pt-5">
          {returnHref && (
            <Link
              href={returnHref}
              scroll={false}
              className={buttonClass("secondary")}
            >
              {tw("cancel")}
            </Link>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? tCommon("saving") : tw("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
