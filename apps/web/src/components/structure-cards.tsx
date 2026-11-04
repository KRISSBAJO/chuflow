import type { ReactNode } from "react";
import { Avatar, Badge, ButtonLink, formatStatus, statusTone, type BadgeTone } from "@/components/ui/ui";
import type { BranchOverview, UserSummary } from "@/lib/types";

export function TeamPills({
  users,
  emptyLabel,
}: {
  users: UserSummary[];
  emptyLabel: string;
}) {
  if (users.length === 0) {
    return <p className="text-[13px] text-[#8a8780]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => {
        const name = `${user.firstName} ${user.lastName}`.trim();
        return (
          <span
            key={user._id}
            className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white py-1 pl-1 pr-3 text-[13px] font-medium text-[#111111]"
          >
            <Avatar name={name || "?"} className="h-6 w-6 text-[10px]" />
            {name}
          </span>
        );
      })}
    </div>
  );
}

function getPastoralCoverage(
  residentPastors: UserSummary[],
  associatePastors: UserSummary[],
): { label: string; tone: BadgeTone; message: string } {
  const hasResidentPastor = residentPastors.length > 0;
  const hasAssociatePastor = associatePastors.length > 0;

  if (hasResidentPastor && hasAssociatePastor) {
    return {
      label: "Pastoral team covered",
      tone: "success",
      message:
        "Resident pastor and associate pastor are both assigned to this branch.",
    };
  }

  if (!hasResidentPastor && !hasAssociatePastor) {
    return {
      label: "Both pastor roles vacant",
      tone: "danger",
      message:
        "This branch still needs both a resident pastor and an associate pastor.",
    };
  }

  if (!hasResidentPastor) {
    return {
      label: "Resident pastor vacant",
      tone: "warning",
      message:
        "Resident pastor is still unassigned. Associate pastor coverage is present.",
    };
  }

  return {
    label: "Associate pastor vacant",
    tone: "warning",
    message:
      "Associate pastor is still unassigned. Resident pastor coverage is present.",
  };
}

function TeamGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-[#f6f5f1] p-4 ${className ?? ""}`}>
      <p className="text-[12px] font-medium text-[#6b6b6b]">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
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
    <div className="rounded-2xl border border-black/[0.06] p-5 xl:col-span-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-[#111111]">Pastoral leadership</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">{coverage.message}</p>
        </div>
        <Badge tone={coverage.tone} dot className="w-fit">
          {coverage.label}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TeamGroup label="Resident pastor">
          <TeamPills
            users={residentPastors}
            emptyLabel="No resident pastor assigned yet."
          />
        </TeamGroup>
        <TeamGroup label="Associate pastor">
          <TeamPills
            users={associatePastors}
            emptyLabel="No associate pastor assigned yet."
          />
        </TeamGroup>
      </div>
    </div>
  );
}

export function BranchCard({ branch }: { branch: BranchOverview }) {
  return (
    <article className="rounded-2xl border border-black/[0.06] p-5 transition-colors hover:border-black/[0.12]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="lp-heading text-[18px]">{branch.name}</h4>
            <Badge tone={statusTone(branch.status)} dot>
              {formatStatus(branch.status)}
            </Badge>
          </div>
          <p className="mt-1 text-[14px] text-[#55534e]">
            {branch.city}, {branch.state} · {branch.serviceTimes}
          </p>
          <p className="mt-0.5 text-[13px] text-[#8a8780]">{branch.contactInfo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="flame">
            <span className="tabular-nums">{branch.metrics.guestCount}</span> guests
          </Badge>
          <Badge>
            <span className="tabular-nums">{branch.metrics.memberCount}</span> members
          </Badge>
          <Badge>
            <span className="tabular-nums">{branch.metrics.activeUserCount}</span> active staff
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <TeamGroup label="Branch admins">
          <TeamPills users={branch.admins} emptyLabel="No branch admin assigned yet." />
        </TeamGroup>
        <PastoralLeadershipCard
          residentPastors={branch.residentPastors}
          associatePastors={branch.associatePastors}
        />
        <TeamGroup label="Follow-up team">
          <TeamPills users={branch.followUpTeam} emptyLabel="No follow-up team assigned." />
        </TeamGroup>
        <TeamGroup label="Ushers">
          <TeamPills users={branch.ushers} emptyLabel="No usher team assigned." />
        </TeamGroup>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href="/branches" variant="secondary" size="sm" icon="branches">
          Open branches
        </ButtonLink>
        <ButtonLink href={`/users?branchId=${branch._id}`} size="sm" icon="users">
          Open branch staff
        </ButtonLink>
      </div>
    </article>
  );
}
