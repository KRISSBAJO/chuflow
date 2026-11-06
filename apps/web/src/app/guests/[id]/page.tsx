import { hasPermission, rolePermissionKeys } from "@/lib/capabilities";
import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
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
  const [t, tc, ts, tsh, format] = await Promise.all([
    getTranslations("people.guests.detail"),
    getTranslations("common"),
    getTranslations("statuses"),
    getTranslations("people.shared"),
    getFormatter(),
  ]);
  type StatusKey = Parameters<typeof ts>[0];
  const statusLabel = (value?: string | null) => {
    if (!value) return "";
    const key = value.toLowerCase();
    return ts.has(key as StatusKey) ? ts(key as StatusKey) : formatStatus(value);
  };
  const formatDateTime = (value?: string) => {
    if (!value) return tsh("noTimestamp");
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? tsh("noTimestamp") : format.dateTime(date, { dateStyle: "short", timeStyle: "short" });
  };
  const formatValue = (value?: string) => value?.replace(/_/g, " ") || tsh("notRecorded");

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
    canAccessRoute(user.role, "/follow-up", user.additionalPermissions)
      ? serverGet<FollowUpListResponse>(`/follow-ups?guestId=${id}`)
      : Promise.resolve({ items: [] }),
    serverGet<VisitItem[]>(`/visits?guestId=${id}`),
    canAccessRoute(user.role, "/communications", user.additionalPermissions)
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
  const canManageFollowUp = hasPermission(user,"follow_up.edit") || hasPermission(user,"follow_up.create");
  const canCommunicate = hasPermission(user,"communications.view");

  const timeline = [
    ...visits.map((visit) => ({
      id: `visit-${visit._id}`,
      when: visit.visitDate,
      type: t("types.visit"),
      text: `${t("visitRecorded", { serviceType: visit.serviceType })}${visit.notes ? ` · ${visit.notes}` : ""}`,
    })),
    ...followUps.map((followUp) => ({
      id: `follow-${followUp._id}`,
      when: followUp.updatedAt || followUp.nextActionDate || "",
      type: t("types.followUp"),
      text: `${statusLabel(followUp.status)} · ${followUp.note}`,
    })),
    ...communications.map((communication) => ({
      id: `communication-${communication._id}`,
      when: communication.createdAt || "",
      type: t("types.communication"),
      text: `${communication.channel} · ${communication.templateName}`,
    })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  const facts = [
    [tc("phone"), guest.phone],
    [tc("email"), guest.email || tsh("notProvided")],
    [tc("branch"), branchName || tsh("unassigned")],
    [t("visitStatus"), formatValue(guest.visitStatus)],
    [t("invitedBy"), guest.invitedBy || tsh("notRecorded")],
    [t("heardThrough"), guest.heardAboutChurch || tsh("notRecorded")],
    [t("address"), [guest.address, guest.city, guest.state].filter(Boolean).join(", ") || tsh("notRecorded")],
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={`${guest.firstName} ${guest.lastName}`}
        description={t("description")}
      />

      <section className="app-card app-rise overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="border-b border-black/[0.06] p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(guest.visitStatus)} dot>
                {statusLabel(guest.visitStatus) || tsh("notRecorded")}
              </Badge>
              <Badge>{branchName || t("unassignedBranch")}</Badge>
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
                <p className="text-[12px] font-medium text-orange-800">{t("prayerRequest")}</p>
                <p className="mt-1 leading-[1.6]">{guest.prayerRequest}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 p-6 sm:p-7">
            <div className="grid grid-cols-3 gap-3">
              <Stat label={t("visits")} value={visits.length} />
              <Stat label={t("followUps")} value={followUps.length} />
              <Stat label={t("messages")} value={communications.length} />
            </div>
            <div className="rounded-2xl border border-black/[0.06] px-4 py-3">
              <p className="text-[12px] text-[#8a8780]">{t("guestId")}</p>
              <p className="mt-0.5 break-all font-mono text-[13px] text-[#55534e]">{id}</p>
            </div>
            {!guest.convertedToMember && canConvertGuests(user.role) ? <ConvertGuestButton guestId={id} /> : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {canManageFollowUp ? (
          <WorkSection
            title={t("careTitle")}
            description={t("careDescription")}
            count={followUps.length}
            defaultOpen
          >
            <GuestFollowUpManager guestId={id} followUps={followUps} users={users} />
          </WorkSection>
        ) : null}

        {hasPermission(user,"guests.edit") && <WorkSection title={t("profileTitle")} description={t("profileDescription")}>
          {hasPermission(user,"guests.edit") && <GuestProfileForm guest={guest} defaultBranchId={user.branchId} />}
        </WorkSection>}

        {rolePermissionKeys(user.role).includes("guests.edit") && <WorkSection title={t("returnTitle")} description={t("returnDescription")}>
          <GuestReturnVisitForm guestId={id} branchId={branchId} followUpId={latestFollowUp?._id} />
        </WorkSection>}

        {canCommunicate ? (
          <WorkSection title={t("commsTitle")} description={t("commsDescription")} count={communications.length}>
            <CommunicationPanel
              recipientType="guest"
              recipientId={id}
              recipient={guest.email || guest.phone}
              communications={communications}
              title={t("commsPanelTitle")}
            />
          </WorkSection>
        ) : null}

        <WorkSection title={t("timelineTitle")} description={t("timelineDescription")} count={timeline.length}>
          {timeline.length > 0 ? (
            <TableWrap>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{t("when")}</th>
                    <th>{t("type")}</th>
                    <th>{t("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap tabular-nums text-[#55534e]">{formatDateTime(item.when)}</td>
                      <td>
                        <Badge>{item.type}</Badge>
                      </td>
                      <td className="text-[#55534e]">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <EmptyState icon="clock" title={t("noActivityTitle")}>
              {t("noActivityBody")}
            </EmptyState>
          )}
        </WorkSection>
      </section>
    </Shell>
  );
}
