import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Avatar, Badge, ButtonLink, statusTone, type BadgeTone } from "@/components/ui/ui";
import { useStatusLabel } from "@/i18n/labels";
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
): { label: "covered" | "bothVacant" | "residentVacant" | "associateVacant"; tone: BadgeTone } {
  const hasResidentPastor = residentPastors.length > 0;
  const hasAssociatePastor = associatePastors.length > 0;

  if (hasResidentPastor && hasAssociatePastor) {
    return { label: "covered", tone: "success" };
  }

  if (!hasResidentPastor && !hasAssociatePastor) {
    return { label: "bothVacant", tone: "danger" };
  }

  if (!hasResidentPastor) {
    return { label: "residentVacant", tone: "warning" };
  }

  return { label: "associateVacant", tone: "warning" };
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
  const t = useTranslations("org.structureCards");
  const coverage = getPastoralCoverage(residentPastors, associatePastors);

  return (
    <div className="rounded-2xl border border-black/[0.06] p-5 xl:col-span-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-[#111111]">{t("pastoralLeadership")}</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">{t(`${coverage.label}Message`)}</p>
        </div>
        <Badge tone={coverage.tone} dot className="w-fit">
          {t(coverage.label)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TeamGroup label={t("residentPastor")}>
          <TeamPills
            users={residentPastors}
            emptyLabel={t("noResidentPastor")}
          />
        </TeamGroup>
        <TeamGroup label={t("associatePastor")}>
          <TeamPills
            users={associatePastors}
            emptyLabel={t("noAssociatePastor")}
          />
        </TeamGroup>
      </div>
    </div>
  );
}

export function BranchCard({ branch }: { branch: BranchOverview }) {
  const t = useTranslations("org.structureCards");
  const statusLabel = useStatusLabel();
  return (
    <article className="rounded-2xl border border-black/[0.06] p-5 transition-colors hover:border-black/[0.12]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="lp-heading text-[18px]">{branch.name}</h4>
            <Badge tone={statusTone(branch.status)} dot>
              {statusLabel(branch.status)}
            </Badge>
          </div>
          <p className="mt-1 text-[14px] text-[#55534e]">
            {branch.city}, {branch.state} · {branch.serviceTimes}
          </p>
          <p className="mt-0.5 text-[13px] text-[#8a8780]">{branch.contactInfo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="flame">
            {t.rich("guestsBadge", { count: branch.metrics.guestCount, n: (chunks) => <span className="tabular-nums">{chunks}</span> })}
          </Badge>
          <Badge>
            {t.rich("membersBadge", { count: branch.metrics.memberCount, n: (chunks) => <span className="tabular-nums">{chunks}</span> })}
          </Badge>
          <Badge>
            {t.rich("activeStaffBadge", { count: branch.metrics.activeUserCount, n: (chunks) => <span className="tabular-nums">{chunks}</span> })}
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <TeamGroup label={t("branchAdmins")}>
          <TeamPills users={branch.admins} emptyLabel={t("noBranchAdmin")} />
        </TeamGroup>
        <PastoralLeadershipCard
          residentPastors={branch.residentPastors}
          associatePastors={branch.associatePastors}
        />
        <TeamGroup label={t("followUpTeam")}>
          <TeamPills users={branch.followUpTeam} emptyLabel={t("noFollowUpTeam")} />
        </TeamGroup>
        <TeamGroup label={t("ushers")}>
          <TeamPills users={branch.ushers} emptyLabel={t("noUsherTeam")} />
        </TeamGroup>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink href="/branches" variant="secondary" size="sm" icon="branches">
          {t("openBranches")}
        </ButtonLink>
        <ButtonLink href={`/users?branchId=${branch._id}`} size="sm" icon="users">
          {t("openBranchStaff")}
        </ButtonLink>
      </div>
    </article>
  );
}
