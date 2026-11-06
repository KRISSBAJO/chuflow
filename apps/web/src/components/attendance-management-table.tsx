"use client";

import { useState, useTransition } from "react";
import { ExportTableButtons } from "@/components/table-export";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAppFormat } from "@/i18n/labels";
import { API_URL } from "@/lib/api";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  Button,
  EmptyState,
  Field,
} from "@/components/ui/ui";
import type {
  AttendanceItem,
  GuestListItem,
  MemberListItem,
  ServiceTypeSummary,
} from "@/lib/types";

export function AttendanceManagementTable({
  records,
  guests,
  members,
  serviceTypes,
  canEdit = true,
}: {
  records: AttendanceItem[];
  guests: GuestListItem[];
  members: MemberListItem[];
  serviceTypes: ServiceTypeSummary[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("services.attendance.cleanup");
  const { dateTime } = useAppFormat();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function updateRecord(recordId: string, formData: FormData) {
    setLoadingId(recordId);

    const personType = String(formData.get(`personType-${recordId}`) ?? "");
    const serviceTypeId = String(
      formData.get(`serviceTypeId-${recordId}`) ?? "",
    ).trim();

    try {
      const response = await fetch(`${API_URL}/attendance/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceDate: formData.get(`serviceDate-${recordId}`),
          serviceTypeId: serviceTypeId || undefined,
          personType,
          guestId:
            personType === "guest"
              ? formData.get(`guestId-${recordId}`) || undefined
              : undefined,
          memberId:
            personType === "member"
              ? formData.get(`memberId-${recordId}`) || undefined
              : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("updateFailed"));
      }

      toast.success(t("toastUpdated"), {
        description: t("toastUpdatedBody"),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(t("toastFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("updateFailed"),
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (records.length === 0) {
    return (
      <EmptyState icon="attendance" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <ExportTableButtons resource="attendance-individual" rows={records} />
      {records.slice(0, 18).map((record) => (
        <details
          key={record._id}
          className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
        >
          <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-[#111111]">
                {record.personType === "guest"
                  ? `${record.guestId?.firstName ?? ""} ${record.guestId?.lastName ?? ""}`.trim() ||
                    t("guestRecord")
                  : `${record.memberId?.firstName ?? ""} ${record.memberId?.lastName ?? ""}`.trim() ||
                    t("memberRecord")}
              </p>
              <p className="mt-0.5 text-[12px] text-[#8a8780]">
                {dateTime(record.serviceDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{record.serviceTypeLabel || record.serviceType}</Badge>
              <Badge tone={record.personType === "guest" ? "flame" : "info"}>
                {record.personType === "guest" ? t("guest") : t("member")}
              </Badge>
              <Icon
                name="chevronDown"
                className="ml-1 h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </div>
          </summary>
          <div className="border-t border-black/[0.06] px-4 py-4">
            <form
              action={(formData) => updateRecord(record._id, formData)}
              className="grid gap-4 md:grid-cols-2"
            >
              <Field label={t("serviceDate")}>
                <input
                  name={`serviceDate-${record._id}`}
                  type="datetime-local"
                  defaultValue={new Date(record.serviceDate)
                    .toISOString()
                    .slice(0, 16)}
                  disabled={!canEdit}
                  className="ui-input"
                />
              </Field>
              <Field label={t("serviceType")}>
                <select
                  name={`serviceTypeId-${record._id}`}
                  defaultValue={record.serviceTypeId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">
                    {t("keepCurrent", { label: record.serviceTypeLabel || record.serviceType })}
                  </option>
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType._id} value={serviceType._id}>
                      {serviceType.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("personType")}>
                <select
                  name={`personType-${record._id}`}
                  defaultValue={record.personType}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="guest">{t("guest")}</option>
                  <option value="member">{t("member")}</option>
                </select>
              </Field>
              <Field label={t("guest")}>
                <select
                  name={`guestId-${record._id}`}
                  defaultValue={record.guestId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">{t("guest")}</option>
                  {guests.map((guest) => (
                    <option key={guest._id} value={guest._id}>
                      {guest.firstName} {guest.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("member")}>
                <select
                  name={`memberId-${record._id}`}
                  defaultValue={record.memberId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">{t("member")}</option>
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              {canEdit ? (
                <div className="flex items-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingId === record._id || pending}
                  >
                    {loadingId === record._id ? t("saving") : t("updateRecord")}
                  </Button>
                </div>
              ) : (
                <p className="text-[13px] text-[#8a8780] md:col-span-2">
                  {t("readOnly")}
                </p>
              )}
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
