"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
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

  return (
    <div className="space-y-3">
      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
          No attendance records match the current filters.
        </div>
      ) : (
        records.slice(0, 18).map((record) => (
          <details key={record._id} className="rounded-[20px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {record.personType === "guest"
                      ? `${record.guestId?.firstName ?? ""} ${record.guestId?.lastName ?? ""}`.trim() || "Guest record"
                      : `${record.memberId?.firstName ?? ""} ${record.memberId?.lastName ?? ""}`.trim() || "Member record"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(record.serviceDate).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {record.serviceTypeLabel || record.serviceType}
                  </span>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">{record.personType}</span>
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <form action={(formData) => updateRecord(record._id, formData)} className="grid gap-2.5 md:grid-cols-2">
                <input
                  name={`serviceDate-${record._id}`}
                  type="datetime-local"
                  defaultValue={new Date(record.serviceDate).toISOString().slice(0, 16)}
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                <select
                  name={`serviceTypeId-${record._id}`}
                  defaultValue={record.serviceTypeId?._id || ""}
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
                <select
                  name={`personType-${record._id}`}
                  defaultValue={record.personType}
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="guest">Guest</option>
                  <option value="member">Member</option>
                </select>
                <select
                  name={`guestId-${record._id}`}
                  defaultValue={record.guestId?._id || ""}
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Guest</option>
                  {guests.map((guest) => (
                    <option key={guest._id} value={guest._id}>
                      {guest.firstName} {guest.lastName}
                    </option>
                  ))}
                </select>
                <select
                  name={`memberId-${record._id}`}
                  defaultValue={record.memberId?._id || ""}
                  disabled={!canEdit}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Member</option>
                  {members.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
                {canEdit ? (
                  <button
                    type="submit"
                    disabled={loadingId === record._id || pending}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:w-fit"
                  >
                    {loadingId === record._id ? "Saving..." : "Update record"}
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 md:col-span-2">
                    This role can review these legacy records but cannot edit them here.
                  </p>
                )}
              </form>
            </div>
          </details>
        ))
      )}
    </div>
  );
}
