"use client";

import { useState } from "react";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { ModalShell } from "@/components/modal-shell";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        Record service summary
      </button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Attendance"
        title="Record service attendance summary"
        description="Capture the ministry-facing totals for men, women, children, adults, first timers, new converts, and Holy Spirit baptism in one focused workflow."
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
