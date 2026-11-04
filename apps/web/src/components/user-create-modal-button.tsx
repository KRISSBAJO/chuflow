"use client";

import { useState } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button } from "@/components/ui/ui";
import { UserCreateForm } from "@/components/user-create-form";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

export function UserCreateModalButton({
  branches,
  currentUserRole,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
}: {
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        Create user
      </Button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Users"
        title="Create user"
        description="Create a user account in the correct leadership or branch scope."
        maxWidthClass="max-w-3xl"
      >
        <UserCreateForm
          branches={branches}
          currentUserRole={currentUserRole}
          defaultBranchId={defaultBranchId}
          defaultOversightRegion={defaultOversightRegion}
          defaultDistrict={defaultDistrict}
          oversightRegions={oversightRegions}
          districts={districts}
          title="User details"
          description="Assign the right role and scope before access goes live."
          submitLabel="Create user"
          showHeader={false}
        />
      </ModalShell>
    </>
  );
}
