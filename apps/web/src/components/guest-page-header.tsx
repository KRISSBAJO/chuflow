"use client";

import { useState } from "react";
import { GuestCreateForm } from "@/components/guest-create-form";
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
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-slate-50/80 shadow-xl border border-white/70 backdrop-blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(at_top_right,#f59e0b15_0%,transparent_50%)]" />

      {showForm ? (
        <div className="relative p-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <div className="h-px w-6 bg-amber-500" />
              <p className="text-sm font-semibold uppercase tracking-[0.125em] text-amber-600">
                Guest capture
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          <GuestCreateForm
            branches={branches}
            users={users}
            serviceTypes={serviceTypes}
            defaultBranchId={defaultBranchId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      ) : (
        <div className="relative flex flex-col gap-8 p-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2">
              <div className="h-px w-6 bg-amber-500" />
              <p className="text-sm font-semibold uppercase tracking-[0.125em] text-amber-600">
                Guests
              </p>
            </div>
            <h1 className="text-5xl font-semibold tracking-tighter leading-[1.05] text-slate-950 lg:text-6xl">
              Guest registry and first-touch coordination
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
              Every connect card, usher-assisted registration, and QR form submission should land
              here with immediate next action clarity.
            </p>
          </div>
          <div className="shrink-0 lg:pb-2">
            <div className="flex justify-end lg:justify-start">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                New guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
