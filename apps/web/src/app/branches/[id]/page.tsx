import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchDetailPanel } from "@/components/branch-detail-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Icon } from "@/components/app/icons";
import { ButtonLink } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type {
  BranchOverview,
  BranchSummary,
  DistrictOption,
  IntakeTemplate,
  OversightRegionOption,
} from "@/lib/types";

function buildBranchOverview(branch: BranchSummary, overview?: BranchOverview): BranchOverview {
  return {
    ...branch,
    ...overview,
    metrics: {
      guestCount: overview?.metrics?.guestCount ?? 0,
      memberCount: overview?.metrics?.memberCount ?? 0,
      teamCount: overview?.metrics?.teamCount ?? 0,
      activeUserCount: overview?.metrics?.activeUserCount ?? 0,
      branchAdminCount: overview?.metrics?.branchAdminCount ?? 0,
      residentPastorCount: overview?.metrics?.residentPastorCount ?? 0,
      associatePastorCount: overview?.metrics?.associatePastorCount ?? 0,
      followUpCount: overview?.metrics?.followUpCount ?? 0,
      usherCount: overview?.metrics?.usherCount ?? 0,
    },
    admins: overview?.admins ?? [],
    residentPastors: overview?.residentPastors ?? [],
    associatePastors: overview?.associatePastors ?? [],
    followUpTeam: overview?.followUpTeam ?? [],
    ushers: overview?.ushers ?? [],
  };
}

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/branches");
  const { id } = await params;

  const [branchRecord, branches, oversightRegions, districts, templates] = await Promise.all([
    serverGet<BranchSummary>(`/branches/${id}`).catch(() => null),
    serverGet<BranchOverview[]>("/branches/overview").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
  ]);

  if (!branchRecord) {
    notFound();
  }

  const branch = buildBranchOverview(
    branchRecord,
    branches.find((item) => item._id === id),
  );

  return (
    <Shell>
      <div className="space-y-3">
        <Link
          href="/branches"
          className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -ml-2 text-[13px] font-medium text-[#6b6b6b] transition-colors hover:bg-white hover:text-[#111111]"
        >
          <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:-translate-x-0.5" />
          Back to branches
        </Link>
        <PageHeader
          eyebrow="Branch detail"
          title={branch.name}
          description={`${branch.city}, ${branch.state} · ${branch.district} · ${branch.oversightRegion}`}
          action={
            <ButtonLink href={`/users?branchId=${branch._id}`} icon="users">
              Branch staff
            </ButtonLink>
          }
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Guests" value={String(branch.metrics.guestCount)} delta="Current guest records" tone="warm" />
        <MetricCard label="Members" value={String(branch.metrics.memberCount)} delta="Current member records" tone="cool" />
        <MetricCard label="Admins" value={String(branch.metrics.branchAdminCount)} delta="Branch admin coverage" tone="cool" />
        <MetricCard
          label="Care team"
          value={String(branch.metrics.followUpCount + branch.metrics.usherCount)}
          delta="Follow-up and usher operators"
          tone="warm"
        />
      </section>

      <BranchDetailPanel
        branch={branch}
        currentUserRole={user.role}
        defaultOversightRegion={user.oversightRegion}
        defaultDistrict={user.district}
        oversightRegions={oversightRegions}
        districts={districts}
        templates={templates}
      />
    </Shell>
  );
}
