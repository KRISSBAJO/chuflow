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
import type { CommunicationItem, FollowUpItem, GuestListItem, UserSummary, VisitItem } from "@/lib/types";

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireServerRole("/guests");
  const { id } = await params;

  const [guest, followUps, visits, communications, users] = await Promise.all([
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
    serverGet<FollowUpItem[]>(`/follow-ups?guestId=${id}`),
    serverGet<VisitItem[]>(`/visits?guestId=${id}`),
    serverGet<CommunicationItem[]>(`/communications?guestId=${id}`).catch(() => []),
    serverGet<UserSummary[]>("/users").catch(() => []),
  ]);

  const branchId =
    guest.branchId && typeof guest.branchId === "object" && "_id" in guest.branchId
      ? guest.branchId._id
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

  return (
    <Shell>
      <PageHeader
        eyebrow="Guest Detail"
        title={`${guest.firstName} ${guest.lastName}`}
        description="This detail view is now the working source of truth for one guest: registration, follow-up, return visits, communication history, and conversion."
      />
      <section className="grid gap-6 2xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-6">
          <section className="surface rounded-[32px] p-8">
            <p className="text-sm uppercase tracking-[0.16em] text-slate-500">Guest ID</p>
            <p className="mt-3 text-2xl font-bold text-slate-950">{id}</p>
            <div className="mt-6 space-y-4">
              {[
                ["Phone", guest.phone],
                ["Email", guest.email || "Not provided"],
                ["Branch", guest.branchId?.name || "Unassigned"],
                ["Visit status", guest.visitStatus.replace("_", " ")],
                ["Invited by", guest.invitedBy || "Not recorded"],
                ["How they heard", guest.heardAboutChurch || "Not recorded"],
                ["Address", [guest.address, guest.city, guest.state].filter(Boolean).join(", ") || "Not recorded"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-2 font-medium text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface rounded-[32px] p-8">
            <p className="eyebrow">Journey Snapshot</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Visits</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{visits.length}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Follow-up</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{followUps.length}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Messages</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{communications.length}</p>
              </div>
            </div>
            {guest.prayerRequest ? (
              <div className="mt-5 rounded-[24px] bg-orange-50 px-5 py-4 text-sm text-orange-950">
                <p className="font-semibold">Prayer request</p>
                <p className="mt-2">{guest.prayerRequest}</p>
              </div>
            ) : null}
          </section>

          {!guest.convertedToMember && canConvertGuests(user.role) ? (
            <ConvertGuestButton guestId={id} />
          ) : null}

          <GuestProfileForm guest={guest} defaultBranchId={user.branchId} />
        </div>

        <div className="space-y-6">
          {canManageFollowUp ? (
            <GuestFollowUpManager guestId={id} followUps={followUps} users={users} />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <GuestReturnVisitForm guestId={id} branchId={branchId} followUpId={latestFollowUp?._id} />
            {canCommunicate ? (
              <CommunicationPanel
                recipientType="guest"
                recipientId={id}
                recipient={guest.email || guest.phone}
                communications={communications}
                title="Send and review outreach history"
              />
            ) : null}
          </div>

          <section className="surface rounded-[32px] p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-950">Timeline</h2>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {timeline.length} events
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {timeline.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <p>{item.text}</p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {item.when ? new Date(item.when).toLocaleString() : "No timestamp"}
                  </p>
                </div>
              ))}
              {timeline.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  No activity has been recorded for this guest yet.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </Shell>
  );
}
