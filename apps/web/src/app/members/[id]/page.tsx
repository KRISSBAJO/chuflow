import { memberGroupNames } from "@/lib/member-service-groups";
import { CommunicationPanel } from "@/components/communication-panel";
import { MemberProfileForm } from "@/components/member-profile-form";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  statusTone,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  formatMembershipStatus,
  formatYesNoStatus,
} from "@/lib/member-form-options";
import { serverGet } from "@/lib/server-api";
import type {
  CommunicationItem,
  MemberListItem,
  ServiceUnitSummary,
} from "@/lib/types";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/members");
  const { id } = await params;

  const [member, communications, serviceUnits] = await Promise.all([
    serverGet<
      MemberListItem & {
        phone?: string;
        email?: string;
        familyDetails?: string;
        guestId?: {
          _id?: string;
          firstName?: string;
          lastName?: string;
        };
      }
    >(`/members/${id}`),
    serverGet<CommunicationItem[]>(`/communications?memberId=${id}`).catch(
      () => [],
    ),
    serverGet<ServiceUnitSummary[]>("/service-units").catch(() => []),
  ]);

  const serviceUnitName = memberGroupNames(member) || "Not set";
  const courseCards = [
    {
      label: "Believers Foundation Class",
      status: formatYesNoStatus(member.believerFoundationClassStatus),
      date: member.believerFoundationClassDate || "Not recorded",
      location: member.believerFoundationClassLocation || "Not recorded",
    },
    {
      label: "BCC",
      status: formatYesNoStatus(member.bccStatus),
      date: member.bccDate || "Not recorded",
      location: member.bccLocation || "Not recorded",
    },
    {
      label: "LCC",
      status: formatYesNoStatus(member.lccStatus),
      date: member.lccDate || "Not recorded",
      location: member.lccLocation || "Not recorded",
    },
    {
      label: "LCD",
      status: formatYesNoStatus(member.lcdStatus),
      date: member.lcdDate || "Not recorded",
      location: member.lcdLocation || "Not recorded",
    },
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Member"
        title={`${member.firstName} ${member.lastName}`}
        description="Membership status, class progress, baptism and service-unit placement in one place."
      />
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="app-rise p-6 sm:p-7">
            <div className="flex items-center gap-4">
              <Avatar
                name={`${member.firstName} ${member.lastName}`}
                className="h-12 w-12 text-[14px]"
              />
              <div className="min-w-0">
                <p className="lp-heading truncate text-[20px] leading-tight">
                  {member.firstName} {member.lastName}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(member.membershipStatus)} dot>
                    {formatMembershipStatus(member.membershipStatus)}
                  </Badge>
                </div>
              </div>
            </div>
            <dl className="mt-5 divide-y divide-black/[0.05]">
              {[
                ["Email", member.email || "Not provided"],
                ["Phone", member.phone || "Not provided"],
                ["Branch", member.branchId?.name || "Unassigned"],
                [
                  "Origin guest",
                  member.guestId
                    ? `${member.guestId.firstName} ${member.guestId.lastName}`
                    : "Direct member record",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-[13px] text-[#8a8780]">{label}</dt>
                  <dd className="break-words text-[14px] font-medium text-[#111111]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-2xl border border-black/[0.06] px-4 py-3">
              <p className="text-[12px] text-[#8a8780]">Member ID</p>
              <p className="mt-0.5 break-all font-mono text-[13px] text-[#55534e]">
                {id}
              </p>
            </div>
          </Card>
          <Card
            className="app-rise p-6 sm:p-7"
            style={{ animationDelay: "60ms" }}
          >
            <CardHeader label="Formation" title="Formation snapshot" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Date joined", member.dateJoinedChurch || "Not recorded"],
                [
                  "Membership status",
                  formatMembershipStatus(member.membershipStatus),
                ],
                [
                  "Holy Ghost baptism",
                  formatYesNoStatus(member.holySpiritBaptismStatus),
                ],
                ["Water baptism", formatYesNoStatus(member.waterBaptismStatus)],
                ["Service groups", serviceUnitName],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                  <p className="text-[12px] text-[#6b6b6b]">{label}</p>
                  <p className="mt-0.5 text-[14px] font-medium text-[#111111]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13px] font-medium text-[#6b6b6b]">
              Classes
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {courseCards.map((course) => (
                <div
                  key={course.label}
                  className="rounded-2xl border border-black/[0.06] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[14px] font-medium text-[#111111]">
                      {course.label}
                    </p>
                    <Badge
                      tone={course.status === "Yes" ? "success" : "neutral"}
                    >
                      {course.status}
                    </Badge>
                  </div>
                  <dl className="mt-2 space-y-0.5 text-[13px] text-[#6b6b6b]">
                    <div className="flex gap-1.5">
                      <dt className="text-[#8a8780]">Date:</dt>
                      <dd>{course.date}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-[#8a8780]">Location:</dt>
                      <dd>{course.location}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-[#f6f5f1] px-4 py-3">
              <p className="text-[12px] text-[#6b6b6b]">Family details</p>
              <p className="mt-0.5 text-[14px] leading-[1.6] text-[#111111]">
                {member.familyDetails || "No family details recorded yet."}
              </p>
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MemberProfileForm
            member={member}
            defaultBranchId={user.branchId}
            serviceUnits={serviceUnits}
          />
          <Card className="p-6 sm:p-7">
            <CommunicationPanel
              recipientType="member"
              recipientId={id}
              recipient={member.email || member.phone || ""}
              communications={communications}
              title="Member care and communication history"
            />
          </Card>
        </div>
      </section>
    </Shell>
  );
}
