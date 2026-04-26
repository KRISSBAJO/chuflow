import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ServiceUnitCreateModalButton } from "@/components/service-unit-create-modal-button";
import { ServiceUnitManagementList } from "@/components/service-unit-management-list";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, MemberListItem, ServiceUnitSummary } from "@/lib/types";

export default async function ServiceUnitsPage() {
  const user = await requireServerRole("/service-units");

  const [serviceUnits, branches, members] = await Promise.all([
    serverGet<ServiceUnitSummary[]>("/service-units"),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<MemberListItem[]>("/members"),
  ]);

  const activeUnits = serviceUnits.filter((unit) => unit.isActive).length;
  const staffedUnits = serviceUnits.filter(
    (unit) => unit.leaderMemberId?._id && unit.secretaryMemberId?._id,
  ).length;
  const assignedMembers = serviceUnits.reduce(
    (total, unit) => total + (unit.memberCount ?? 0),
    0,
  );

  return (
    <Shell>
      <PageHeader
        eyebrow="Service Units"
        title="Branch service-unit structure and staffing"
        description="Create the real ministry teams for each branch, appoint leadership, and connect members directly into the units they serve."
        action={
          <ServiceUnitCreateModalButton
            branches={branches}
            members={members}
            defaultBranchId={user.branchId}
            currentUserRole={user.role}
          />
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Service units"
          value={String(serviceUnits.length)}
          delta="Visible in the current branch scope"
          tone="cool"
        />
        <MetricCard
          label="Active units"
          value={String(activeUnits)}
          delta={`${Math.max(serviceUnits.length - activeUnits, 0)} inactive`}
          tone="warm"
        />
        <MetricCard
          label="Fully staffed"
          value={String(staffedUnits)}
          delta="Leader and secretary assigned"
          tone="cool"
        />
        <MetricCard
          label="Assigned members"
          value={String(assignedMembers)}
          delta="Members currently linked to a unit"
          tone="warm"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="surface rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Service unit directory</h2>
              <p className="mt-1 text-xs text-slate-500">
                Edit structure, officers, meeting rhythm, and member load without leaving the branch scope.
              </p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Branch isolated
            </div>
          </div>
          <div className="mt-4">
            <ServiceUnitManagementList
              serviceUnits={serviceUnits}
              members={members}
              branches={branches}
              currentUserRole={user.role}
            />
          </div>
        </section>

        <section className="space-y-4">
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Ministry operations</p>
            <div className="mt-3 space-y-2.5 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Service units now feed directly into member placement so interest is no longer free text.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Leaders and secretaries are pulled from members inside the same branch only.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                Public member intake can now land people into the right branch environment and service structure faster.
              </div>
            </div>
          </section>
        </section>
      </section>
    </Shell>
  );
}
