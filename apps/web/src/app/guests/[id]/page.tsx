import type { ReactNode } from "react";
import { CommunicationPanel } from "@/components/communication-panel";
import { ConvertGuestButton } from "@/components/convert-guest-button";
import { GuestFollowUpManager } from "@/components/guest-follow-up-manager";
import { GuestProfileForm } from "@/components/guest-profile-form";
import { GuestReturnVisitForm } from "@/components/guest-return-visit-form";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { requireServerRole } from "@/lib/auth";
import { canConvertGuests } from "@/lib/permissions";
import { serverGet } from "@/lib/server-api";
import type {
  CommunicationItem,
  FollowUpListResponse,
  GuestListItem,
  UserSummary,
  VisitItem,
} from "@/lib/types";

function formatDateTime(value?: string) {
  if (!value) {
    return "No timestamp";
  }

  return new Date(value).toLocaleString();
}

function formatValue(value?: string) {
  return value?.replace(/_/g, " ") || "Not recorded";
}

function WorkSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-[24px] border border-slate-200 bg-white shadow-sm" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <span className="font-semibold text-slate-950">{title}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {typeof count === "number" ? count : "Open"}
        </span>
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/60 p-4">{children}</div>
    </details>
  );
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/guests");
  const { id } = await params;

  const [guest, followUpList, visits, communications, users] = await Promise.all([
    serverGet<GuestListItem & {
      address?: string;
      city?: string;
      state?: string;
      prayerRequest?: string;
      invitedBy?: string;
      heardAboutChurch?: string;
      maritalStatus?: string;
      createdAt?: string;
      convertedToMember?: boolean;
    }>(`/guests/${id}`),
    serverGet<FollowUpListResponse>(`/follow-ups?guestId=${id}`),
    serverGet<VisitItem[]>(`/visits?guestId=${id}`),
    serverGet<CommunicationItem[]>(`/communications?guestId=${id}`).catch(() => []),
    serverGet<UserSummary[]>("/users").catch(() => []),
  ]);

  const followUps = followUpList.items;
  const guestBranch = guest.branchId as unknown;
  const branchId =
    typeof guestBranch === "string"
      ? guestBranch
      : guestBranch && typeof guestBranch === "object" && "_id" in guestBranch
        ? String((guestBranch as { _id?: string })._id ?? "")
        : undefined;
  const branchName =
    guestBranch && typeof guestBranch === "object" && "name" in guestBranch
      ? (guestBranch as { name?: string }).name
      : undefined;

  const latestFollowUp = followUps[0];
  const canManageFollowUp = [
    "super_admin",
    "national_admin",
    "national_pastor",
    "district_admin",
    "district_pastor",
    "branch_admin",
    "resident_pastor",
    "associate_pastor",
    "follow_up",
  ].includes(user.role);
  const canCommunicate = canManageFollowUp;

  const timeline = [
    ...visits.map((visit) => ({
      id: `visit-${visit._id}`,
      when: visit.visitDate,
      type: "visit",
      text: `Visit recorded for ${visit.serviceType}${visit.notes ? ` · ${visit.notes}` : ""}`,
    })),
    ...followUps.map((followUp) => ({
      id: `follow-${followUp._id}`,
      when: followUp.updatedAt || followUp.nextActionDate || "",
      type: "follow-up",
      text: `${followUp.status.replace("_", " ")} · ${followUp.note}`,
    })),
    ...communications.map((communication) => ({
      id: `communication-${communication._id}`,
      when: communication.createdAt || "",
      type: "communication",
      text: `${communication.channel} · ${communication.templateName}`,
    })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  const facts = [
    ["Phone", guest.phone],
    ["Email", guest.email || "Not provided"],
    ["Branch", branchName || "Unassigned"],
    ["Visit status", formatValue(guest.visitStatus)],
    ["Invited by", guest.invitedBy || "Not recorded"],
    ["Heard through", guest.heardAboutChurch || "Not recorded"],
    ["Address", [guest.address, guest.city, guest.state].filter(Boolean).join(", ") || "Not recorded"],
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Guest Detail"
        title={`${guest.firstName} ${guest.lastName}`}
        description="A focused guest record for profile details, care work, return visits, communication history, and conversion."
      />

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                {formatValue(guest.visitStatus)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {branchName || "Unassigned branch"}
              </span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {facts.map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-36 py-3 pr-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {label}
                      </th>
                      <td className="py-3 font-medium text-slate-700">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {guest.prayerRequest ? (
              <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-950">
                <p className="font-semibold">Prayer request</p>
                <p className="mt-2">{guest.prayerRequest}</p>
              </div>
            ) : null}
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Visits", visits.length],
                ["Follow-up", followUps.length],
                ["Messages", communications.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Guest ID</p>
              <p className="mt-1 break-all text-sm font-medium text-slate-700">{id}</p>
            </div>
            {!guest.convertedToMember && canConvertGuests(user.role) ? (
              <div className="mt-4">
                <ConvertGuestButton guestId={id} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {canManageFollowUp ? (
          <WorkSection title="Care and follow-up" count={followUps.length} defaultOpen>
            <GuestFollowUpManager guestId={id} followUps={followUps} users={users} />
          </WorkSection>
        ) : null}

        <WorkSection title="Profile fields">
          <GuestProfileForm guest={guest} defaultBranchId={user.branchId} />
        </WorkSection>

        <WorkSection title="Return visit">
          <GuestReturnVisitForm guestId={id} branchId={branchId} followUpId={latestFollowUp?._id} />
        </WorkSection>

        {canCommunicate ? (
          <WorkSection title="Communications" count={communications.length}>
            <CommunicationPanel
              recipientType="guest"
              recipientId={id}
              recipient={guest.email || guest.phone}
              communications={communications}
              title="Send and review outreach history"
            />
          </WorkSection>
        ) : null}

        <WorkSection title="Timeline" count={timeline.length}>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(item.when)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.text}</td>
                  </tr>
                ))}
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                      No activity has been recorded for this guest yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </WorkSection>
      </section>
    </Shell>
  );
}
