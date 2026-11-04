import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { OutreachFollowUpForm } from "@/components/evangelism/follow-up-form";
import { OutreachGuestLink } from "@/components/evangelism/guest-link";
import { Badge, buttonClass, Card } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  outreachLabel,
  outreachName,
  type OutreachContact,
} from "@/lib/evangelism";
import type { UserSummary } from "@/lib/types";

function date(value: string) {
  return (
    new Date(value).toLocaleString("en-US", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " UTC"
  );
}

export default async function OutreachContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/evangelism");
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
      <Link href="/evangelism" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> Back to Evangelism
      </Link>
      <PageHeader
        eyebrow="Evangelism contact"
        title={`${contact.firstName} ${contact.lastName}`}
        description={`${contact.branchId.name} · Reached ${date(contact.createdAt)}`}
        action={
          <Badge
            tone={contact.stage === "do_not_contact" ? "warning" : "neutral"}
          >
            {outreachLabel(contact.stage)}
          </Badge>
        }
      />
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <Card className="p-6 sm:p-7">
            <h2 className="text-xl font-semibold">Connection details</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              {[
                ["Phone", contact.phone],
                ["Email", contact.email],
                ["City / area", contact.city],
                [
                  "Preferred contact",
                  outreachLabel(contact.preferredContactMethod),
                ],
                ["Best time", contact.preferredContactTime],
                [
                  "Interested in",
                  contact.interest
                    ? outreachLabel(contact.interest)
                    : undefined,
                ],
                ["Follow-up owner", outreachName(contact.assignedTo)],
                [
                  "Reached by",
                  contact.reachedBy
                    ? outreachName(contact.reachedBy)
                    : "Branch outreach",
                ],
                ["Source link", contact.linkId?.name || "Staff capture"],
                [
                  "Next action",
                  contact.nextActionDate
                    ? date(contact.nextActionDate)
                    : "Not scheduled",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-[#8a8780]">{label}</dt>
                  <dd className="mt-1 break-words text-sm">
                    {value || "Not provided"}
                  </dd>
                </div>
              ))}
            </dl>
            {contact.prayerRequest && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-medium">Prayer request</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#6b6b6b]">
                  {contact.prayerRequest}
                </p>
              </div>
            )}
            <p className="mt-5 text-xs text-[#8a8780]">
              Permission to contact:{" "}
              {contact.consentToContact
                ? `recorded ${date(contact.consentRecordedAt)}`
                : "withdrawn — do not contact"}
              .
            </p>
            {canContact && (
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                  className={buttonClass("secondary", "sm")}
                >
                  Call
                </a>
                <a
                  href={`sms:${contact.phone.replace(/[^+\d]/g, "")}`}
                  className={buttonClass("secondary", "sm")}
                >
                  Text
                </a>
                <a
                  href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary", "sm")}
                >
                  WhatsApp
                </a>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    Email
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
                  Open linked guest record
                </Link>
                <p className="mt-2 text-xs text-[#8a8780]">
                  {contact.guestId.convertedToMember
                    ? "This guest has become a member."
                    : "Continue visit tracking and guest-to-member follow-up from this record."}
                </p>
              </div>
            ) : contact.consentToContact ? (
              <OutreachGuestLink contactId={contact._id} />
            ) : null}
          </Card>
          <Card className="p-6 sm:p-7">
            <h2 className="text-xl font-semibold">Follow-up history</h2>
            <ol className="mt-5 space-y-4">
              {[...contact.activities].reverse().map((activity, index) => (
                <li key={index} className="rounded-2xl bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge>{outreachLabel(activity.stage)}</Badge>
                    <time className="text-xs text-[#8a8780]">
                      {date(activity.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                    {activity.note}
                  </p>
                  <p className="mt-3 text-xs text-[#8a8780]">
                    {activity.recordedBy
                      ? outreachName(activity.recordedBy)
                      : "Public form"}{" "}
                    · {outreachLabel(activity.contactMethod)} · Owner:{" "}
                    {outreachName(activity.assignedTo)}
                  </p>
                  {activity.nextActionDate && (
                    <p className="mt-1 text-xs text-[#8a8780]">
                      Next action: {date(activity.nextActionDate)}
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
