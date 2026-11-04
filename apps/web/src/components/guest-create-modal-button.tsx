"use client";

import { useState } from "react";
import { GuestCreateForm } from "@/components/guest-create-form";
import { ModalShell } from "@/components/modal-shell";
import { buttonClass } from "@/components/ui/ui";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

export function GuestCreateModalButton({
  branches,
  users,
  serviceTypes,
  defaultBranchId,
  label = "New guest",
  className = buttonClass("primary"),
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
        title="Register a guest"
        description="The full assisted-registration form for ushers and office staff. Guests registering themselves or by QR code use the public guest form instead."
        maxWidthClass="max-w-3xl"
      >
        <GuestCreateForm
          branches={branches}
          users={users}
          serviceTypes={serviceTypes}
          defaultBranchId={defaultBranchId}
          onSuccess={() => setOpen(false)}
        />
      </ModalShell>
    </>
  );
}
