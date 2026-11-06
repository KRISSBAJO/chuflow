"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("services.attendance.modal");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
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
