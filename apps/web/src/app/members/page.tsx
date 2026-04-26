import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ConvertGuestForm } from "@/components/convert-guest-form";
import { MemberCreateForm } from "@/components/member-create-form";
import { TemplateQrCard } from "@/components/template-qr-card";
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
        description="Member management should feel connected to the guest journey, not like a separate database. Promote guests cleanly and keep growth milestones visible."
        action={
          <a href="#member-create" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Add member
          </a>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active members" value={String(activeMembers)} delta="Current active membership records" tone="cool" />
        <MetricCard label="Pending conversion" value={String(pendingConversion)} delta="Guest records not yet converted to members" tone="warm" />
        <MetricCard label="Foundation class" value={String(foundationClass)} delta="Members still progressing through foundations" tone="cool" />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="surface overflow-hidden rounded-[32px]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-950">Member roster</h2>
            <p className="mt-1 text-sm text-slate-500">
              Direct CRUD via <code>/api/members</code> and conversion via <code>/api/members/convert/:guestId</code>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Member", "Status", "Holy Spirit", "Foundation", "Service unit"].map((column) => (
                    <th key={column} className="px-6 py-4 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {members.map((member) => (
                  <tr key={member._id} className="border-t border-slate-100">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <Link href={`/members/${member._id}`} className="hover:text-orange-700">
                        {[formatMemberTitle(member.title), member.firstName, member.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatMembershipStatus(member.membershipStatus)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatYesNoStatus(member.holySpiritBaptismStatus)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatYesNoStatus(member.believerFoundationClassStatus)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {member.serviceUnitId?.name || member.serviceUnitInterest || "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-6">
          <section className="surface rounded-[32px] p-6">
            <p className="eyebrow">Public member intake</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Share this branch-scoped member intake directly. It creates a member
              record without creating a guest first, and the template branch stays
              the isolator for the submission.
            </p>
            <div className="mt-4">
              {activeMemberTemplate ? (
                <TemplateQrCard
                  url={
                    activeMemberTemplate.shareUrl ||
                    `http://localhost:3001/intake/${activeMemberTemplate.slug}`
                  }
                  title={`${activeMemberTemplate.name} share link`}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  No active member intake template is available yet in this scope.
                </div>
              )}
            </div>
          </section>
          <section id="member-create" className="surface rounded-[32px] p-2">
            <MemberCreateForm
              branches={branches}
              guests={guests}
              serviceUnits={serviceUnits}
              defaultBranchId={user.branchId}
            />
          </section>
          <section className="surface rounded-[32px] p-2">
            <ConvertGuestForm guests={guests.filter((guest) => guest.visitStatus !== "member")} />
          </section>
          <section className="surface rounded-[32px] p-6">
            <p className="eyebrow">Conversion funnel</p>
            <div className="mt-5 space-y-4">
              {[
                ["Total guest records", String(guests.length)],
                ["Ready for conversion", String(pendingConversion)],
                ["Converted members", String(members.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-4">
                  <span className="text-slate-600">{label}</span>
                  <span className="text-xl font-bold text-slate-950">{value}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="surface rounded-[32px] p-6">
            <p className="eyebrow">Formation milestones</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Track Bible school attendance, Holy Ghost baptism, water baptism,
              and service-unit placement so new members move from attendance into
              real belonging.
            </p>
          </section>
        </div>
      </section>
    </Shell>
  );
}
