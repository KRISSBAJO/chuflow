import type { ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { CommunicationPanel } from "@/components/communication-panel";
import { ConvertGuestButton } from "@/components/convert-guest-button";
import { GuestFollowUpManager } from "@/components/guest-follow-up-manager";
import { GuestProfileForm } from "@/components/guest-profile-form";
import { GuestReturnVisitForm } from "@/components/guest-return-visit-form";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Badge, EmptyState, formatStatus, Stat, statusTone, TableWrap } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { canAccessRoute, canConvertGuests } from "@/lib/permissions";
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
  description,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="app-card group overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-[#faf9f6] sm:px-7 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="lp-heading block text-[18px] leading-tight">{title}</span>
          {description ? <span className="mt-1 block text-[13px] text-[#6b6b6b]">{description}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {typeof count === "number" ? <Badge>{count}</Badge> : null}
          <Icon name="chevronDown" className="h-4 w-4 text-[#8a8780] transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-black/[0.06] p-6 sm:p-7">{children}</div>
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
    canAccessRoute(user.role, "/follow-up")
      ? serverGet<FollowUpListResponse>(`/follow-ups?guestId=${id}`)
      : Promise.resolve({ items: [] }),
    serverGet<VisitItem[]>(`/visits?guestId=${id}`),
    canAccessRoute(user.role, "/communications")
      ? serverGet<CommunicationItem[]>(`/communications?guestId=${id}`).catch(() => [])
      : Promise.resolve([]),
    serverGet<UserSummary[]>("/users/assignment-options").catch(() => []),
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
        eyebrow="Guest"
        title={`${guest.firstName} ${guest.lastName}`}
        description="Profile details, care work, return visits, communication history and conversion for this guest."
      />

      <section className="app-card app-rise overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="border-b border-black/[0.06] p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(guest.visitStatus)} dot>
                {formatStatus(guest.visitStatus) || "Not recorded"}
              </Badge>
              <Badge>{branchName || "Unassigned branch"}</Badge>
            </div>
            <dl className="mt-5 divide-y divide-black/[0.05]">
              {facts.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-[13px] text-[#8a8780]">{label}</dt>
                  <dd className="break-words text-[14px] font-medium text-[#111111]">{value}</dd>
                </div>
              ))}
            </dl>
            {guest.prayerRequest ? (
              <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3.5 text-[14px] text-orange-950">
                <p className="text-[12px] font-medium text-orange-800">Prayer request</p>
                <p className="mt-1 leading-[1.6]">{guest.prayerRequest}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 p-6 sm:p-7">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Visits" value={visits.length} />
              <Stat label="Follow-ups" value={followUps.length} />
              <Stat label="Messages" value={communications.length} />
            </div>
            <div className="rounded-2xl border border-black/[0.06] px-4 py-3">
              <p className="text-[12px] text-[#8a8780]">Guest ID</p>
              <p className="mt-0.5 break-all font-mono text-[13px] text-[#55534e]">{id}</p>
            </div>
            {!guest.convertedToMember && canConvertGuests(user.role) ? <ConvertGuestButton guestId={id} /> : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {canManageFollowUp ? (
          <WorkSection
            title="Care and follow-up"
            description="Assign care workers and keep each follow-up record current."
            count={followUps.length}
            defaultOpen
          >
            <GuestFollowUpManager guestId={id} followUps={followUps} users={users} />
          </WorkSection>
        ) : null}

        <WorkSection title="Profile details" description="Keep the guest's contact and background details accurate.">
          <GuestProfileForm guest={guest} defaultBranchId={user.branchId} />
        </WorkSection>

        <WorkSection title="Return visit" description="Record attendance and mark the guest as returned.">
          <GuestReturnVisitForm guestId={id} branchId={branchId} followUpId={latestFollowUp?._id} />
        </WorkSection>

        {canCommunicate ? (
          <WorkSection title="Communications" description="Send a message and review outreach history." count={communications.length}>
            <CommunicationPanel
              recipientType="guest"
              recipientId={id}
              recipient={guest.email || guest.phone}
              communications={communications}
              title="Send and review outreach history"
            />
          </WorkSection>
        ) : null}

        <WorkSection title="Timeline" description="Visits, follow-ups and messages, newest first." count={timeline.length}>
          {timeline.length > 0 ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap tabular-nums text-[#55534e]">{formatDateTime(item.when)}</td>
                      <td>
                        <Badge>{formatStatus(item.type)}</Badge>
                      </td>
                      <td className="text-[#55534e]">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState icon="clock" title="No activity yet">
              No activity has been recorded for this guest yet.
            </EmptyState>
          )}
        </WorkSection>
      </section>
    </Shell>
  );
}
