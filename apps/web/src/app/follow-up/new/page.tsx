import Link from "next/link";
import { FollowUpCreateForm } from "@/components/follow-up-create-form";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import {
  canFilterAcrossBranches,
  isGlobalRole,
  isNationalRole,
} from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  GuestListResponse,
  UserSummary,
} from "@/lib/types";

function buildReturnHref(filters: {
  oversightRegion?: string;
  district?: string;
  branchId?: string;
}) {
  const query = new URLSearchParams();

  if (filters.oversightRegion) {
    query.set("oversightRegion", filters.oversightRegion);
  }

  if (filters.district) {
    query.set("district", filters.district);
  }

  if (filters.branchId) {
    query.set("branchId", filters.branchId);
  }

  return query.toString() ? `/follow-up?${query.toString()}` : "/follow-up";
}

export default async function NewFollowUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    oversightRegion?: string;
    district?: string;
    branchId?: string;
  }>;
}) {
  const user = await requireServerRole("/follow-up/new");
  const params = await searchParams;
  const canChooseBranch = canFilterAcrossBranches(user.role);
  const requestedOversightRegion = isGlobalRole(user.role)
    ? params.oversightRegion?.trim() || undefined
    : user.oversightRegion;
  const requestedDistrict =
    isGlobalRole(user.role) || isNationalRole(user.role)
      ? params.district?.trim() || undefined
      : user.district;
  const selectedBranchId = canChooseBranch ? params.branchId?.trim() : user.branchId;

  const branches = await serverGet<BranchSummary[]>("/branches").catch(() => []);

  const filteredBranches = branches.filter((branch) => {
    if (requestedOversightRegion && branch.oversightRegion !== requestedOversightRegion) {
      return false;
    }

    if (requestedDistrict && branch.district !== requestedDistrict) {
      return false;
    }

    return true;
  });

  const effectiveBranchId =
    selectedBranchId &&
    filteredBranches.some((branch) => branch._id === selectedBranchId)
      ? selectedBranchId
      : undefined;
  const createBranchScopeId =
    effectiveBranchId ||
    (!canChooseBranch ? user.branchId : undefined) ||
    (filteredBranches.length === 1 ? filteredBranches[0]._id : undefined);
  const selectedBranch = branches.find((branch) => branch._id === createBranchScopeId);
  const returnHref = buildReturnHref({
    oversightRegion: requestedOversightRegion,
    district: requestedDistrict,
    branchId: effectiveBranchId,
  });
  const guestQuery = new URLSearchParams({ page: "1", limit: "100" });

  if (createBranchScopeId) {
    guestQuery.set("branchId", createBranchScopeId);
  }

  const [guestOptions, users] = await Promise.all([
    createBranchScopeId
      ? serverGet<GuestListResponse>(`/guests?${guestQuery.toString()}`).catch(() => ({
          items: [],
          pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
        }))
      : Promise.resolve({
          items: [],
          pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
        }),
    createBranchScopeId
      ? serverGet<UserSummary[]>(`/users?branchId=${encodeURIComponent(createBranchScopeId)}`).catch(
          () => [],
        )
      : Promise.resolve([]),
  ]);

  const assignmentDisabled = canChooseBranch && !createBranchScopeId;
  const assignmentHint = assignmentDisabled
    ? "Return to the queue and choose a branch first so guests and care workers stay in the same branch."
    : "Assigning a care worker automatically moves this record from New to Assigned.";

  return (
    <Shell>
      <div className="space-y-4">
        <Link
          href={returnHref}
          aria-label="Return to follow-up queue"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm hover:border-slate-300"
        >
          &lt;
        </Link>
        <PageHeader
          eyebrow="Follow-Up"
          title="Add follow-up"
          description={
            selectedBranch
              ? `Create a care task for ${selectedBranch.name}.`
              : "Choose a branch from the follow-up queue before creating a branch-local care task."
          }
        />
      </div>

      <section className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-2 shadow-sm">
        <FollowUpCreateForm
          guests={guestOptions.items}
          users={users}
          currentUserRole={user.role}
          currentUserId={user.id || user._id}
          guestSelectionDisabled={assignmentDisabled}
          guestSelectionHint={
            assignmentDisabled
              ? "A branch is required before choosing a guest for follow-up."
              : guestOptions.items.length === 0
                ? "No guests are available in the selected branch yet."
                : undefined
          }
          assignmentDisabled={assignmentDisabled}
          assignmentHint={assignmentHint}
          successRedirectHref={returnHref}
        />
      </section>
    </Shell>
  );
}
