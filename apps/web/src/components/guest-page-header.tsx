"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GuestCreateForm } from "@/components/guest-create-form";
import { Button, Card, CardHeader } from "@/components/ui/ui";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

export function GuestPageHeader({
  branches,
  users,
  serviceTypes,
  defaultBranchId,
}: {
  branches: BranchSummary[];
  users: UserSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <Card className="app-rise p-6 sm:p-7">
        <CardHeader
          label="Guest capture"
          title="Register a guest"
          description="Capture the guest's details now so follow-up can start right away."
          action={
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          }
        />
        <div className="mt-6">
          <GuestCreateForm
            branches={branches}
            users={users}
            serviceTypes={serviceTypes}
            defaultBranchId={defaultBranchId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="app-rise flex flex-col gap-6 pt-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="lp-label">Guests</p>
        <h1 className="lp-heading mt-3 text-[2rem] leading-[1.08] sm:text-[2.5rem]">
          Guest registry and first-touch coordination
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#6b6b6b]">
          Every connect card, usher-assisted registration and QR form submission lands here with a clear next step.
        </p>
      </div>
      <div className="shrink-0">
        <Button icon="plus" onClick={() => router.push("/guests/new")}>
          New guest
        </Button>
      </div>
    </div>
  );
}
