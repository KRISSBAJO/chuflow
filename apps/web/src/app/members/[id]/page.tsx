import { CommunicationPanel } from "@/components/communication-panel";
import { MemberProfileForm } from "@/components/member-profile-form";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { requireServerRole } from "@/lib/auth";
import { formatMembershipStatus, formatYesNoStatus } from "@/lib/member-form-options";
import { serverGet } from "@/lib/server-api";
import type { CommunicationItem, MemberListItem, ServiceUnitSummary } from "@/lib/types";

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
    serverGet<CommunicationItem[]>(`/communications?memberId=${id}`).catch(() => []),
    serverGet<ServiceUnitSummary[]>("/service-units").catch(() => []),
  ]);

  const serviceUnitName = member.serviceUnitId?.name || member.serviceUnitInterest || "Not set";
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
        eyebrow="Member Profile"
        title={`${member.firstName} ${member.lastName}`}
        description="This profile should be the place where membership status, class progress, baptism state, and service-unit interest all meet."
      />
      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <section className="surface rounded-[32px] p-8">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-500">Member ID</p>
            <p className="mt-3 text-2xl font-bold text-slate-950">{id}</p>
            <div className="mt-6 space-y-4">
              {[
                ["Email", member.email || "Not provided"],
                ["Phone", member.phone || "Not provided"],
                ["Branch", member.branchId?.name || "Unassigned"],
                ["Origin guest", member.guestId ? `${member.guestId.firstName} ${member.guestId.lastName}` : "Direct member record"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-2 font-medium text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="surface rounded-[32px] p-8">
            <p className="eyebrow">Formation Snapshot</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Date joined", member.dateJoinedChurch || "Not recorded"],
                ["Membership status", formatMembershipStatus(member.membershipStatus)],
                ["Holy Ghost baptism", formatYesNoStatus(member.holySpiritBaptismStatus)],
                ["Water baptism", formatYesNoStatus(member.waterBaptismStatus)],
                ["Service unit", serviceUnitName],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-2 font-medium text-slate-700">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {courseCards.map((course) => (
                <div key={course.label} className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    {course.label}
                  </p>
                  <p className="mt-2 font-medium text-slate-700">
                    {course.status}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Date: {course.date}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Location: {course.location}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Family details</p>
              <p className="mt-2 font-medium text-slate-700">{member.familyDetails || "No family details recorded yet."}</p>
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <MemberProfileForm
            member={member}
            defaultBranchId={user.branchId}
            serviceUnits={serviceUnits}
          />
          <CommunicationPanel
            recipientType="member"
            recipientId={id}
            recipient={member.email || member.phone || ""}
            communications={communications}
            title="Member care and communication history"
          />
        </div>
      </section>
    </Shell>
  );
}
