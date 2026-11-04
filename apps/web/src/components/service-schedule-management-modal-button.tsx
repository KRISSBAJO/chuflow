"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui/ui";
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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Manage service schedules
      </Button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Service scheduling"
        title="Define recurring branch services"
        description="Set up first service, second service, midweek and other repeating gatherings so attendance and finance attach to the right service."
        maxWidthClass="max-w-6xl"
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-black/[0.06] p-5">
            <ServiceScheduleCreateForm
              branches={branches}
              serviceTypes={serviceTypes}
              defaultBranchId={defaultBranchId}
              currentUserRole={currentUserRole}
            />
          </div>
          <div className="rounded-2xl border border-black/[0.06] p-5">
            <div className="mb-4">
              <p className="text-[13px] font-medium text-[#6b6b6b]">Existing schedules</p>
              <h3 className="lp-heading mt-1 text-[18px]">Review and update the service rhythm</h3>
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
