"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Icon } from "@/components/app/icons";
import { Badge, Button, EmptyState, Field, formatStatus } from "@/components/ui/ui";
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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function updateRecord(recordId: string, formData: FormData) {
    setLoadingId(recordId);

    const personType = String(formData.get(`personType-${recordId}`) ?? "");
    const serviceTypeId = String(formData.get(`serviceTypeId-${recordId}`) ?? "").trim();

    try {
      const response = await fetch(`${API_URL}/attendance/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceDate: formData.get(`serviceDate-${recordId}`),
          serviceTypeId: serviceTypeId || undefined,
          personType,
          guestId: personType === "guest" ? formData.get(`guestId-${recordId}`) || undefined : undefined,
          memberId: personType === "member" ? formData.get(`memberId-${recordId}`) || undefined : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update attendance");
      }

      toast.success("Attendance record updated", {
        description: "The service type, person link, and service date were saved.",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error("Attendance update failed", {
        description:
          error instanceof Error ? error.message : "Unable to update attendance",
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (records.length === 0) {
    return (
      <EmptyState icon="attendance" title="No records found">
        No attendance records match the current filters.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {records.slice(0, 18).map((record) => (
        <details
          key={record._id}
          className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
        >
          <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-[#111111]">
                {record.personType === "guest"
                  ? `${record.guestId?.firstName ?? ""} ${record.guestId?.lastName ?? ""}`.trim() || "Guest record"
                  : `${record.memberId?.firstName ?? ""} ${record.memberId?.lastName ?? ""}`.trim() || "Member record"}
              </p>
              <p className="mt-0.5 text-[12px] text-[#8a8780]">{new Date(record.serviceDate).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{record.serviceTypeLabel || record.serviceType}</Badge>
              <Badge tone={record.personType === "guest" ? "flame" : "info"}>{formatStatus(record.personType)}</Badge>
              <Icon name="chevronDown" className="ml-1 h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="border-t border-black/[0.06] px-4 py-4">
            <form action={(formData) => updateRecord(record._id, formData)} className="grid gap-4 md:grid-cols-2">
              <Field label="Service date">
                <input
                  name={`serviceDate-${record._id}`}
                  type="datetime-local"
                  defaultValue={new Date(record.serviceDate).toISOString().slice(0, 16)}
                  disabled={!canEdit}
                  className="ui-input"
                />
              </Field>
              <Field label="Service type">
                <select
                  name={`serviceTypeId-${record._id}`}
                  defaultValue={record.serviceTypeId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">
                    {record.serviceTypeLabel || record.serviceType} (keep current)
                  </option>
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType._id} value={serviceType._id}>
                      {serviceType.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Person type">
                <select
                  name={`personType-${record._id}`}
                  defaultValue={record.personType}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="guest">Guest</option>
                  <option value="member">Member</option>
                </select>
              </Field>
              <Field label="Guest">
                <select
                  name={`guestId-${record._id}`}
                  defaultValue={record.guestId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">Guest</option>
                  {guests.map((guest) => (
                    <option key={guest._id} value={guest._id}>
                      {guest.firstName} {guest.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Member">
                <select
                  name={`memberId-${record._id}`}
                  defaultValue={record.memberId?._id || ""}
                  disabled={!canEdit}
                  className="ui-input"
                >
                  <option value="">Member</option>
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              </Field>
              {canEdit ? (
                <div className="flex items-end">
                  <Button type="submit" size="sm" disabled={loadingId === record._id || pending}>
                    {loadingId === record._id ? "Saving..." : "Update record"}
                  </Button>
                </div>
              ) : (
                <p className="text-[13px] text-[#8a8780] md:col-span-2">
                  Your role can review these older records but cannot edit them here.
                </p>
              )}
            </form>
          </div>
        </details>
      ))}
    </div>
  );
}
