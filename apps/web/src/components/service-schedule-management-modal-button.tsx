"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { ServiceScheduleCreateForm } from "@/components/service-schedule-create-form";
import { ServiceScheduleManagementList } from "@/components/service-schedule-management-list";
import type { BranchSummary, ServiceScheduleSummary, ServiceTypeSummary } from "@/lib/types";

export function ServiceScheduleManagementModalButton({
  branches,
  serviceTypes,
  serviceSchedules,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
      >
        Manage service schedules
      </button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Service scheduling"
        title="Define recurring branch services"
        description="Set up first service, second service, midweek, and other repeating branch gatherings so attendance and finance attach to the right service instance."
        maxWidthClass="max-w-6xl"
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="surface rounded-[24px] p-5">
            <ServiceScheduleCreateForm
              branches={branches}
              serviceTypes={serviceTypes}
              defaultBranchId={defaultBranchId}
              currentUserRole={currentUserRole}
            />
          </div>
          <div className="surface rounded-[24px] p-5">
            <div className="mb-4">
              <p className="eyebrow">Existing schedules</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Review and update branch service rhythm
              </h3>
            </div>
            <ServiceScheduleManagementList
              schedules={serviceSchedules}
              branches={branches}
              serviceTypes={serviceTypes}
              currentUserRole={currentUserRole}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
