import { ExtraAnswers } from "@/components/extra-answers";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { OutreachFollowUpForm } from "@/components/evangelism/follow-up-form";
import { OutreachGuestLink } from "@/components/evangelism/guest-link";
import { Badge, buttonClass, Card } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  isOutreachLabelValue,
  outreachName,
  type OutreachContact,
} from "@/lib/evangelism";
import type { UserSummary } from "@/lib/types";

export default async function OutreachContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/evangelism");
  const [t, tLabels, tc, tsh, format] = await Promise.all([
    getTranslations("people.evangelism.detail"),
    getTranslations("people.evangelism.labels"),
    getTranslations("common"),
    getTranslations("people.shared"),
    getFormatter(),
  ]);
  const label = (value: string) => (isOutreachLabelValue(value) ? tLabels(value) : value);
  const date = (value: string) =>
    tsh("utc", {
      date: format.dateTime(new Date(value), { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }),
    });
  const { id } = await params;
  const contact = await serverGet<OutreachContact>(
    `/evangelism/contacts/${id}`,
  );
  const users = await serverGet<UserSummary[]>(
    `/evangelism/team/${contact.branchId._id}`,
  );
  const activeUsers = users.filter((user) => user.isActive !== false);
  if (
    contact.assignedTo &&
    !activeUsers.some((person) => person._id === contact.assignedTo?._id)
  )
    activeUsers.push({ ...contact.assignedTo, email: "", role: "" });
  const canContact =
    contact.consentToContact &&
    !["do_not_contact", "closed"].includes(contact.stage);
  return (
    <Shell>
      <ExtraAnswers answers={contact.customAnswers} />
      <Link href="/evangelism" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={`${contact.firstName} ${contact.lastName}`}
        description={t("reached", { branch: contact.branchId.name, date: date(contact.createdAt) })}
        action={
          <Badge
            tone={contact.stage === "do_not_contact" ? "warning" : "neutral"}
          >
            {label(contact.stage)}
          </Badge>
        }
      />
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <Card className="p-6 sm:p-7">
            <h2 className="text-xl font-semibold">{t("connectionDetails")}</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                [tc("phone"), contact.phone],
                [tc("email"), contact.email],
                [t("cityArea"), contact.city],
                [
                  t("preferredContact"),
                  label(contact.preferredContactMethod),
                ],
                [t("bestTime"), contact.preferredContactTime],
                [
                  t("interestedIn"),
                  contact.interest
                    ? label(contact.interest)
                    : undefined,
                ],
                [t("followUpOwner"), outreachName(contact.assignedTo, tsh("unassigned"))],
                [
                  t("reachedBy"),
                  contact.reachedBy
                    ? outreachName(contact.reachedBy, tsh("unassigned"))
                    : t("branchOutreach"),
                ],
                [t("sourceLink"), contact.linkId?.name || t("staffCapture")],
                [
                  t("nextAction"),
                  contact.nextActionDate
                    ? date(contact.nextActionDate)
                    : t("notScheduled"),
                ],
              ].map(([itemLabel, value]) => (
                <div key={itemLabel}>
                  <dt className="text-xs text-[#8a8780]">{itemLabel}</dt>
                  <dd className="mt-1 break-words text-sm">
                    {value || tsh("notProvided")}
                  </dd>
                </div>
              ))}
            </dl>
            {contact.prayerRequest && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-medium">{t("prayerRequest")}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#6b6b6b]">
                  {contact.prayerRequest}
                </p>
              </div>
            )}
            <p className="mt-5 text-xs text-[#8a8780]">
              {contact.consentToContact
                ? t("permissionRecorded", { date: date(contact.consentRecordedAt) })
                : t("permissionWithdrawn")}
            </p>
            {canContact && (
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                  className={buttonClass("secondary", "sm")}
                >
                  {t("call")}
                </a>
                <a
                  href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`}
                  className={buttonClass("secondary", "sm")}
                >
                  {t("text")}
                </a>
                <a
                  href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary", "sm")}
                >
                  {t("whatsapp")}
                </a>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    {tc("email")}
                  </a>
                )}
              </div>
            )}
            {contact.guestId ? (
              <div className="mt-6 border-t pt-5">
                <Link
                  href={`/guests/${contact.guestId._id}`}
                  className={buttonClass("secondary", "sm")}
                >
                  {t("openGuest")}
                </Link>
                <p className="mt-2 text-xs text-[#8a8780]">
                  {contact.guestId.convertedToMember
                    ? t("becameMember")
                    : t("continueTracking")}
                </p>
              </div>
            ) : contact.consentToContact ? (
              <OutreachGuestLink contactId={contact._id} />
            ) : null}
          </Card>
          <Card className="p-6 sm:p-7">
            <h2 className="text-xl font-semibold">{t("history")}</h2>
            <ol className="mt-5 space-y-4">
              {[...contact.activities].reverse().map((activity, index) => (
                <li key={index} className="rounded-2xl bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge>{label(activity.stage)}</Badge>
                    <time className="text-xs text-[#8a8780]">
                      {date(activity.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                    {activity.note}
                  </p>
                  <p className="mt-3 text-xs text-[#8a8780]">
                    {t("activityMeta", {
                      by: activity.recordedBy ? outreachName(activity.recordedBy, tsh("unassigned")) : t("publicForm"),
                      method: label(activity.contactMethod),
                      owner: outreachName(activity.assignedTo, tsh("unassigned")),
                    })}
                  </p>
                  {activity.nextActionDate && (
                    <p className="mt-1 text-xs text-[#8a8780]">
                      {t("nextActionAt", { date: date(activity.nextActionDate) })}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <OutreachFollowUpForm
          key={`${contact._id}-${contact.activities.length}`}
          contact={contact}
          users={activeUsers}
        />
      </section>
    </Shell>
  );
}
