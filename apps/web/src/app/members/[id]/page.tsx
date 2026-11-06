import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { memberGroupNames } from "@/lib/member-service-groups";
import { CommunicationPanel } from "@/components/communication-panel";
import { MemberProfileForm } from "@/components/member-profile-form";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  buttonClass,
  statusTone,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  MEMBER_COURSE_GROUPS,
  normalizeYesNoValue,
} from "@/lib/member-form-options";
import { safeReturnTo } from "@/lib/workspace-navigation";
import { serverGet } from "@/lib/server-api";
import type {
  CommunicationItem,
  MemberListItem,
  ServiceUnitSummary,
} from "@/lib/types";

type MemberDetail = MemberListItem & {
  recordType?: string;
  phone?: string;
  email?: string;
  familyDetails?: string;
  guestId?: { _id?: string; firstName?: string; lastName?: string };
};

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/members");
  const { id } = await params;
  const query = await searchParams;
  const [t, tw, tc, options] = await Promise.all([
    getTranslations("org.memberDetail"),
    getTranslations("workspace"),
    getTranslations("common"),
    getTranslations("org.memberOptions"),
  ]);
  const [member, communications, serviceUnits] = await Promise.all([
    serverGet<MemberDetail>(`/members/${id}`),
    serverGet<CommunicationItem[]>(`/communications?memberId=${id}`).catch(
      () => [],
    ),
    serverGet<ServiceUnitSummary[]>("/service-units").catch(() => []),
  ]);
  const familyLinks = [
    "super_admin",
    "national_admin",
    "district_admin",
    "branch_admin",
    "resident_pastor",
  ].includes(user.role)
    ? await serverGet<{
        families: { _id: string; name: string }[];
        children: {
          _id: string;
          firstName: string;
          lastName: string;
          familyId: string;
        }[];
      }>(`/children/member-families/${id}`).catch(() => null)
    : null;
  const back = safeReturnTo(query.returnTo, "/members");
  const href = (tab: string, edit = false) =>
    `/members/${id}?${new URLSearchParams({ tab, returnTo: back, ...(edit ? { edit: "1" } : {}) })}`;
  const edit = (tab: string) => member.recordType === "child" ? null : (
    <Link
      href={href(tab, true)}
      scroll={false}
      className={buttonClass("secondary", "sm")}
    >
      {tw("edit")}
    </Link>
  );
  const editing = (section: "profile" | "growth" | "groups") =>
    member.recordType !== "child" && query.edit === "1" && query.tab === section ? (
      <MemberProfileForm
        member={member}
        defaultBranchId={user.branchId}
        serviceUnits={serviceUnits}
        section={section}
        returnHref={href(section)}
      />
    ) : null;
  const yesNo = (v?: string) =>
    normalizeYesNoValue(v) === "yes"
      ? tc("yes")
      : normalizeYesNoValue(v) === "no"
        ? tc("no")
        : options("notRecorded");
  const summary = (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <Avatar name={`${member.firstName} ${member.lastName}`} />
        <h2 className="text-lg font-semibold">
          {member.firstName} {member.lastName}
        </h2>
      </div>
      <dl className="mt-5 divide-y divide-black/5">
        {[
          [tc("email"), member.email || t("notProvided")],
          [tc("phone"), member.phone || t("notProvided")],
          [tc("branch"), member.branchId?.name || t("unassigned")],
          [
            t("originGuest"),
            member.guestId
              ? `${member.guestId.firstName} ${member.guestId.lastName}`
              : t("directRecord"),
          ],
        ].map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-sm text-[#8a8780]">{label}</dt>
            <dd className="break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 break-all text-xs text-[#8a8780]">
        {t("memberId")}: {id}
      </p>
    </Card>
  );
  const formation = (
    <Card className="p-6">
      <CardHeader title={t("formationTitle")} />
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          [t("dateJoined"), member.dateJoinedChurch || options("notRecorded")],
          [
            t("membershipStatus"),
            options(
              `membershipStatus.${member.membershipStatus === "new_member" ? "new_member" : member.membershipStatus === "inactive" ? "inactive" : member.membershipStatus === "worker" ? "worker" : "active"}`,
            ),
          ],
          [t("holyGhostBaptism"), yesNo(member.holySpiritBaptismStatus)],
          [t("waterBaptism"), yesNo(member.waterBaptismStatus)],
          [t("serviceGroups"), memberGroupNames(member) || t("notSet")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3">
            <dt className="text-xs text-[#8a8780]">{label}</dt>
            <dd className="mt-1 text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
  const values = member as unknown as Record<string, string | undefined>;
  return (
    <Shell>
      <Link
        href={back}
        className="text-sm text-[#6b6b6b] hover:text-orange-700"
      >
        ← {tw("backMembers")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={`${member.firstName} ${member.lastName}`}
        description={member.branchId?.name || t("unassigned")}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone(member.membershipStatus)}>
              {member.membershipStatus}
            </Badge>
            {edit(
              ["profile", "growth", "groups"].includes(query.tab || "")
                ? query.tab!
                : "profile",
            )}
          </div>
        }
      />
      <WorkspaceTabs
        defaultTab="overview"
        tabs={[
          {
            id: "overview",
            label: tw("overview"),
            content: (
              <div className="grid gap-5 xl:grid-cols-2">
                {summary}
                {formation}
              </div>
            ),
          },
          {
            id: "profile",
            label: tw("profile"),
            content: editing("profile") || (
              <div className="grid gap-5 xl:grid-cols-2">
                {summary}
                <Card className="p-6">
                  <CardHeader
                    title={t("familyDetails")}
                    action={edit("profile")}
                  />
                  <p className="mt-5 whitespace-pre-wrap text-sm">
                    {member.familyDetails || t("noFamilyDetails")}
                  </p>
                  {familyLinks && (
                    <div className="mt-6 border-t border-black/5 pt-4">
                      <h3 className="text-sm font-medium">{tw("children")}</h3>
                      {familyLinks.children.length ? (
                        <ul className="mt-3 space-y-2">
                          {familyLinks.children.map((child) => (
                            <li key={child._id}>
                              <Link
                                className="text-sm text-orange-700"
                                href={`/children/families/${child.familyId}/children/${child._id}`}
                              >
                                {child.firstName} {child.lastName} ↗
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[#8a8780]">
                          {tw("noChildren")}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            id: "growth",
            label: tw("growth"),
            content: editing("growth") || (
              <>
                <div className="flex justify-end">{edit("growth")}</div>
                {formation}
                <div className="grid gap-4 sm:grid-cols-2">
                  {MEMBER_COURSE_GROUPS.map((group) => (
                    <Card key={group.key} className="p-5">
                      <CardHeader
                        title={options(
                          `courses.${group.key}.title` as Parameters<
                            typeof options
                          >[0],
                        )}
                        action={
                          <Badge
                            tone={
                              normalizeYesNoValue(values[group.statusName]) ===
                              "yes"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {yesNo(values[group.statusName])}
                          </Badge>
                        }
                      />
                      <dl className="mt-4 space-y-2 text-sm">
                        <div>
                          <dt className="text-[#8a8780]">{t("dateLabel")}</dt>
                          <dd>
                            {values[group.dateName] || options("notRecorded")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[#8a8780]">
                            {t("locationLabel")}
                          </dt>
                          <dd>
                            {values[group.locationName] ||
                              options("notRecorded")}
                          </dd>
                        </div>
                      </dl>
                    </Card>
                  ))}
                </div>
              </>
            ),
          },
          {
            id: "groups",
            label: tw("groups"),
            content: editing("groups") || (
              <Card className="p-6">
                <CardHeader title={tw("groups")} action={edit("groups")} />
                <p className="mt-5 text-sm">
                  {memberGroupNames(member) || tw("noGroup")}
                </p>
              </Card>
            ),
          },
          {
            id: "care",
            label: tw("care"),
            content: (
              <Card className="p-6">
                <div className="mb-5">
                  <Link
                    href={`/care?q=${encodeURIComponent(`${member.firstName} ${member.lastName}`)}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    {tw("careLink")} ↗
                  </Link>
                </div>
                <CommunicationPanel
                  recipientType="member"
                  recipientId={id}
                  recipient={member.email || member.phone || ""}
                  communications={communications}
                  title={t("communicationTitle")}
                />
              </Card>
            ),
          },
        ]}
      />
    </Shell>
  );
}
