import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchDetailPanel } from "@/components/branch-detail-panel";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
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
      <div className="space-y-4">
        <Link
          href="/branches"
          aria-label="Return to branches"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm hover:border-slate-300"
        >
          &lt;
        </Link>
        <PageHeader
          eyebrow="Branch Detail"
          title={branch.name}
          description={`${branch.city}, ${branch.state} · ${branch.district} · ${branch.oversightRegion}`}
          action={
            <a
              href={`/users?branchId=${branch._id}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Branch staff
            </a>
          }
        />
      </div>

      <section className="grid gap-3 md:grid-cols-4">
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
