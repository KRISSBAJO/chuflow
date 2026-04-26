"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { ServiceUnitCreateForm } from "@/components/service-unit-create-form";
import type { BranchSummary, MemberListItem } from "@/lib/types";

export function ServiceUnitCreateModalButton({
  branches,
  members,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  members: MemberListItem[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        Create service unit
      </button>
      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Service units"
        title="Create service unit"
        description="Create a branch ministry team, appoint leadership, and prepare it for member assignment."
        maxWidthClass="max-w-4xl"
      >
        <ServiceUnitCreateForm
          branches={branches}
          members={members}
          defaultBranchId={defaultBranchId}
          currentUserRole={currentUserRole}
          showHeader={false}
          onSuccess={() => setOpen(false)}
        />
      </ModalShell>
    </>
  );
}
