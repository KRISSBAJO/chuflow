"use client";

import { useState } from "react";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui/ui";
import type {
  BranchSummary,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

export function AttendanceSummaryModalButton({
  branches,
  serviceTypes,
  serviceSchedules,
  defaultBranchId,
}: {
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  serviceSchedules: ServiceScheduleSummary[];
  defaultBranchId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        Record service summary
      </Button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Attendance"
        title="Record service attendance summary"
        description="Capture totals for men, women, children, adults, first timers, new converts and Holy Spirit baptism in one place."
      >
        <AttendanceCreateForm
          branches={branches}
          serviceTypes={serviceTypes}
          serviceSchedules={serviceSchedules}
          defaultBranchId={defaultBranchId}
          onSuccess={() => setOpen(false)}
        />
      </ModalShell>
    </>
  );
}
