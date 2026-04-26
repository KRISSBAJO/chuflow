import Link from "next/link";
import type { BranchOverview, UserSummary } from "@/lib/types";

export function TeamPills({
  users,
  emptyLabel,
}: {
  users: UserSummary[];
  emptyLabel: string;
}) {
  if (users.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          key={user._id}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {user.firstName} {user.lastName}
        </span>
      ))}
    </div>
  );
}

function getPastoralCoverage(
  residentPastors: UserSummary[],
  associatePastors: UserSummary[],
) {
  const hasResidentPastor = residentPastors.length > 0;
  const hasAssociatePastor = associatePastors.length > 0;

  if (hasResidentPastor && hasAssociatePastor) {
    return {
      label: "Pastoral team covered",
      tone: "bg-emerald-50 text-emerald-700",
      message:
        "Resident pastor and associate pastor are both assigned to this branch.",
    };
  }

  if (!hasResidentPastor && !hasAssociatePastor) {
    return {
      label: "Both pastor roles vacant",
      tone: "bg-rose-50 text-rose-700",
      message:
        "This branch still needs both a resident pastor and an associate pastor.",
    };
  }

  if (!hasResidentPastor) {
    return {
      label: "Resident pastor vacant",
      tone: "bg-amber-50 text-amber-700",
      message:
        "Resident pastor is still unassigned. Associate pastor coverage is present.",
    };
  }

  return {
    label: "Associate pastor vacant",
    tone: "bg-amber-50 text-amber-700",
    message:
      "Associate pastor is still unassigned. Resident pastor coverage is present.",
  };
}

export function PastoralLeadershipCard({
  residentPastors,
  associatePastors,
}: {
  residentPastors: UserSummary[];
  associatePastors: UserSummary[];
}) {
  const coverage = getPastoralCoverage(residentPastors, associatePastors);

  return (
    <div className="rounded-2xl bg-slate-50 p-4 xl:col-span-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Pastoral Leadership
          </p>
          <p className="mt-2 text-sm text-slate-500">{coverage.message}</p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${coverage.tone}`}
        >
          {coverage.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Resident Pastor
          </p>
          <div className="mt-3">
            <TeamPills
              users={residentPastors}
              emptyLabel="No resident pastor assigned yet."
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Associate Pastor
          </p>
          <div className="mt-3">
            <TeamPills
              users={associatePastors}
              emptyLabel="No associate pastor assigned yet."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BranchCard({ branch }: { branch: BranchOverview }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-slate-950">{branch.name}</h4>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                branch.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {branch.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {branch.city}, {branch.state} · {branch.serviceTimes}
          </p>
          <p className="mt-1 text-sm text-slate-500">{branch.contactInfo}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-orange-50 px-3 py-1.5 font-semibold text-orange-700">
            {branch.metrics.guestCount} guests
          </span>
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 font-semibold text-cyan-700">
            {branch.metrics.memberCount} members
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
            {branch.metrics.activeUserCount} active staff
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Branch Admins
          </p>
          <div className="mt-3">
            <TeamPills users={branch.admins} emptyLabel="No branch admin assigned yet." />
          </div>
        </div>
        <PastoralLeadershipCard
          residentPastors={branch.residentPastors}
          associatePastors={branch.associatePastors}
        />
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Follow-Up Team
          </p>
          <div className="mt-3">
            <TeamPills users={branch.followUpTeam} emptyLabel="No follow-up team assigned." />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Ushers
          </p>
          <div className="mt-3">
            <TeamPills users={branch.ushers} emptyLabel="No usher team assigned." />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/branches"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Open branches
        </Link>
        <Link
          href={`/users?branchId=${branch._id}`}
          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        >
          Open branch staff
        </Link>
      </div>
    </div>
  );
}
