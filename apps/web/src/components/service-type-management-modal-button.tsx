"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui/ui";
import { ServiceTypeCreateForm } from "@/components/service-type-create-form";
import { ServiceTypeManagementList } from "@/components/service-type-management-list";
import type { BranchSummary, ServiceTypeSummary } from "@/lib/types";

export function ServiceTypeManagementModalButton({
  branches,
  serviceTypes,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Manage service types
      </Button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Attendance setup"
        title="Manage service types"
        description="Create and edit branch service types so attendance and intake forms use a consistent dropdown instead of free text."
        maxWidthClass="max-w-6xl"
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-black/[0.06] p-5">
            <ServiceTypeCreateForm
              branches={branches}
              defaultBranchId={defaultBranchId}
              currentUserRole={currentUserRole}
            />
          </div>
          <div className="rounded-2xl border border-black/[0.06] p-5">
            <div className="mb-4">
              <p className="text-[13px] font-medium text-[#6b6b6b]">Existing service types</p>
              <h3 className="lp-heading mt-1 text-[18px]">Review and update options</h3>
            </div>
            <ServiceTypeManagementList
              serviceTypes={serviceTypes}
              branches={branches}
              currentUserRole={currentUserRole}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
