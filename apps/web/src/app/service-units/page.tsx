import { Icon, type IconName } from "@/components/app/icons";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ServiceUnitCreateModalButton } from "@/components/service-unit-create-modal-button";
import { ServiceUnitManagementList } from "@/components/service-unit-management-list";
import { Shell } from "@/components/shell";
import { Badge, Card, CardHeader } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, MemberListItem, ServiceUnitSummary } from "@/lib/types";

const OPERATIONS_NOTES: { icon: IconName; text: string }[] = [
  {
    icon: "members",
    text: "Service units feed directly into member placement, so a member's ministry is picked from a list instead of typed in.",
  },
  {
    icon: "users",
    text: "Leaders and secretaries can only be chosen from members of the same branch.",
  },
  {
    icon: "arrowRight",
    text: "Public member sign-ups land people in the right branch and service structure faster.",
  },
];

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
        eyebrow="Service units"
        title="Service units and staffing"
        description="Create the ministry teams for each branch, appoint leaders, and connect members to the units they serve in."
        action={
          <ServiceUnitCreateModalButton
            branches={branches}
            members={members}
            defaultBranchId={user.branchId}
            currentUserRole={user.role}
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)] xl:items-start">
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader
            label="Directory"
            title="Service units"
            description="Edit structure, officers, meeting days, and notes without leaving the branch scope."
            action={<Badge>Branch isolated</Badge>}
          />
          <div className="mt-6">
            <ServiceUnitManagementList
              serviceUnits={serviceUnits}
              members={members}
              branches={branches}
              currentUserRole={user.role}
            />
          </div>
        </Card>

        <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader label="How it works" title="Ministry operations" />
          <ul className="mt-5 space-y-3">
            {OPERATIONS_NOTES.map((note) => (
              <li key={note.text} className="flex gap-3 rounded-2xl bg-[#f6f5f1] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#ea580c] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
                  <Icon name={note.icon} className="h-4 w-4" />
                </span>
                <p className="text-[14px] leading-[1.6] text-[#55534e]">{note.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Shell>
  );
}
