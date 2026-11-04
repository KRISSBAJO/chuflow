"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui/ui";
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
      <Button icon="plus" onClick={() => setOpen(true)}>
        Create service unit
      </Button>
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
