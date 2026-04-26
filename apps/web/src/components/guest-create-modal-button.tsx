"use client";

import { useState } from "react";
import { GuestCreateForm } from "@/components/guest-create-form";
import { ModalShell } from "@/components/modal-shell";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

export function GuestCreateModalButton({
  branches,
  users,
  serviceTypes,
  defaultBranchId,
  label = "New guest",
  className = "rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white",
}: {
  branches: BranchSummary[];
  users: UserSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Guest capture"
        title="Register a guest with the full desk form"
        description="Use the full assisted-registration form here for ushers or office staff. Public self-registration and QR capture can use the public guest form instead."
        maxWidthClass="max-w-7xl"
      >
        <div className="px-2 pb-3 pt-2">
            <GuestCreateForm
              branches={branches}
              users={users}
              serviceTypes={serviceTypes}
              defaultBranchId={defaultBranchId}
              onSuccess={() => setOpen(false)}
            />
        </div>
      </ModalShell>
    </>
  );
}
