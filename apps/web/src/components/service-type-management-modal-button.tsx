"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
      >
        Manage service types
      </button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Attendance setup"
        title="Manage service types in one place"
        description="Create and edit branch service types here so every attendance and intake workflow uses a clean dropdown instead of free-text values."
        maxWidthClass="max-w-6xl"
      >
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="surface rounded-[24px] p-5">
            <ServiceTypeCreateForm
              branches={branches}
              defaultBranchId={defaultBranchId}
              currentUserRole={currentUserRole}
            />
          </div>
          <div className="surface rounded-[24px] p-5">
            <div className="mb-4">
              <p className="eyebrow">Existing service types</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Review and update dropdown options
              </h3>
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
