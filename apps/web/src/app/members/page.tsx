import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ConvertGuestForm } from "@/components/convert-guest-form";
import { MemberCreateForm } from "@/components/member-create-form";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Icon } from "@/components/app/icons";
import { Avatar, Badge, buttonClass, Card, CardHeader, EmptyState, statusTone, TableWrap } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import {
  formatMemberTitle,
  formatMembershipStatus,
  formatYesNoStatus,
  normalizeYesNoValue,
} from "@/lib/member-form-options";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  GuestListResponse,
  IntakeTemplate,
  MemberListItem,
  ServiceUnitSummary,
} from "@/lib/types";

export default async function MembersPage() {
  const user = await requireServerRole("/members");

  const [members, branches, guestList, serviceUnits, templates] = await Promise.all([
    serverGet<MemberListItem[]>("/members"),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<GuestListResponse>("/guests?limit=500").catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1 },
      summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
    })),
    serverGet<ServiceUnitSummary[]>("/service-units").catch(() => []),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
  ]);
  const guests = guestList.items;

  const activeMembers = members.filter((member) => member.membershipStatus === "active").length;
  const pendingConversion = guests.filter((guest) => guest.visitStatus !== "member").length;
  const foundationClass = members.filter(
    (member) => normalizeYesNoValue(member.believerFoundationClassStatus) !== "yes",
  ).length;
  const activeMemberTemplate =
    templates.find(
      (template) =>
        template.kind === "member" &&
        template.isActive &&
        template.branchId === user.branchId,
    ) ||
    templates.find(
      (template) =>
        template.kind === "member" && template.isActive && !template.branchId,
    );


  return (
    <Shell>
      <PageHeader
        eyebrow="Members"
        title="Member growth and conversion records"
        description="Member records stay connected to the guest journey. Convert guests cleanly and keep growth milestones visible."
        action={
          <a href="#member-create" className={buttonClass("primary", "md")}>
            <Icon name="plus" className="h-4 w-4" />
            Add member
          </a>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active members" value={String(activeMembers)} delta="Current active membership records" tone="cool" />
        <MetricCard label="Pending conversion" value={String(pendingConversion)} delta="Guest records not yet converted to members" tone="warm" />
        <MetricCard label="Foundation class" value={String(foundationClass)} delta="Members still progressing through foundations" tone="cool" />
      </section>
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label="Roster"
            title="Member roster"
            description="View and update member records in the current branch scope."
            action={<Badge>{members.length} {members.length === 1 ? "member" : "members"}</Badge>}
          />
          <div className="mt-6">
            {members.length > 0 ? (
              <TableWrap>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Status</th>
                      <th>Holy Spirit</th>
                      <th>Foundation</th>
                      <th>Service unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const fullName = [formatMemberTitle(member.title), member.firstName, member.lastName]
                        .filter(Boolean)
                        .join(" ");
                      const holySpirit = formatYesNoStatus(member.holySpiritBaptismStatus);
                      const foundation = formatYesNoStatus(member.believerFoundationClassStatus);

                      return (
                        <tr key={member._id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar name={`${member.firstName} ${member.lastName}`} />
                              <Link
                                href={`/members/${member._id}`}
                                className="font-medium text-[#111111] underline-offset-4 hover:text-[#ea580c] hover:underline"
                              >
                                {fullName}
                              </Link>
                            </div>
                          </td>
                          <td>
                            <Badge tone={statusTone(member.membershipStatus)} dot>
                              {formatMembershipStatus(member.membershipStatus)}
                            </Badge>
                          </td>
                          <td>
                            <Badge tone={yesNoTone(holySpirit)}>{holySpirit}</Badge>
                          </td>
                          <td>
                            <Badge tone={yesNoTone(foundation)}>{foundation}</Badge>
                          </td>
                          <td className="text-[#55534e]">
                            {member.serviceUnitId?.name || member.serviceUnitInterest || "Not set"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            ) : (
              <EmptyState icon="members" title="No members yet">
                No members are available in the current branch scope yet.
              </EmptyState>
            )}
          </div>
          <p className="mt-5 border-t border-black/[0.06] pt-4 text-[13px] text-[#8a8780]">
            Showing <span className="font-medium tabular-nums text-[#111111]">{members.length}</span> member
            {members.length === 1 ? "" : "s"}
          </p>
        </Card>
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-6 sm:p-7">
            <CardHeader
              label="Public member intake"
              title="Share link"
              description="Share this branch intake form directly. It creates a member record without creating a guest first, and the submission stays in the template's branch."
            />
            <div className="mt-5">
              {activeMemberTemplate ? (
                <TemplateQrCard
                  url={
                    activeMemberTemplate.shareUrl ||
                    `http://localhost:3001/intake/${activeMemberTemplate.slug}`
                  }
                  title={`${activeMemberTemplate.name} share link`}
                />
              ) : (
                <EmptyState icon="templates" title="No intake form yet">
                  No active member intake template is available in this scope yet.
                </EmptyState>
              )}
            </div>
          </Card>
          <Card id="member-create" className="scroll-mt-24 p-6 sm:p-7">
            <CardHeader
              label="New member"
              title="Add member"
              description="Direct member intake, no guest record required. Link a guest only when this member is continuing an existing guest journey."
            />
            <div className="mt-6">
              <MemberCreateForm
                branches={branches}
                guests={guests}
                serviceUnits={serviceUnits}
                defaultBranchId={user.branchId}
              />
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader
              label="Conversion"
              title="Convert guest to member"
              description="Pick a guest who is ready to become a member."
            />
            <div className="mt-5">
              <ConvertGuestForm guests={guests.filter((guest) => guest.visitStatus !== "member")} />
            </div>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader label="Conversion funnel" title="Guest to member" />
            <dl className="mt-5 divide-y divide-black/[0.05]">
              {[
                ["Total guest records", String(guests.length)],
                ["Ready for conversion", String(pendingConversion)],
                ["Converted members", String(members.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <dt className="text-[14px] text-[#55534e]">{label}</dt>
                  <dd className="lp-heading text-[20px] tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-6 sm:p-7">
            <CardHeader
              label="Formation milestones"
              title="From attendance to belonging"
              description="Track Bible school attendance, Holy Ghost baptism, water baptism and service-unit placement so new members move from attending into real belonging."
            />
          </Card>
        </div>
      </section>
    </Shell>
  );
}

function yesNoTone(value: string) {
  if (value === "Yes") return "success" as const;
  if (value === "No") return "warning" as const;
  return "neutral" as const;
}
