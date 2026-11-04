import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { OutreachLinkToggle } from "@/components/evangelism/link-form";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { outreachName, type OutreachLink } from "@/lib/evangelism";

export default async function OutreachLinksPage() {
  await requireServerRole("/evangelism");
  const links = await serverGet<OutreachLink[]>("/evangelism/links");
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL || "https://www.chuflow.com"
  ).replace(/\/$/, "");
  return (
    <Shell>
      <Link href="/evangelism" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> Back to Evangelism
      </Link>
      <PageHeader
        eyebrow="Evangelism"
        title="Open the door to a conversation."
        description="Share a personal or branch link, send it in a message, or let someone scan its QR code. No sign-in is needed to connect."
        action={
          <Link href="/evangelism/links/new" className={buttonClass("primary")}>
            + Create link
          </Link>
        }
      />
      {links.length ? (
        <section className="grid items-start gap-5 lg:grid-cols-2">
          {links.map((link) => (
            <Card key={link._id} className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">{link.name}</h2>
                <Badge tone={link.isActive ? "success" : "neutral"}>
                  {link.isActive ? "Active" : "Paused"}
                </Badge>
              </div>
              <p className="text-sm text-[#6b6b6b]">
                {link.branchId?.name} ·{" "}
                {link.kind === "personal"
                  ? `Personal link · ${outreachName(link.ownerId)}`
                  : "Branch link · shared queue"}
              </p>
              <p className="text-sm font-medium">
                {link.contactCount}{" "}
                {link.contactCount === 1 ? "person" : "people"} connected
                through this link
              </p>
              {link.isActive ? (
                <TemplateQrCard
                  url={`${origin}/outreach/${link.token}`}
                  title={link.name}
                />
              ) : (
                <p className="rounded-xl bg-white p-4 text-sm">
                  This link is paused. Existing contacts remain in your queue.
                </p>
              )}
              <p className="text-sm text-[#6b6b6b]">
                Church shown on form: {link.churchName || link.branchId?.name}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/evangelism/links/${link._id}/edit`}
                  className={buttonClass("secondary", "sm")}
                >
                  Edit link
                </Link>
                <OutreachLinkToggle id={link._id} active={link.isActive} />
                {link.isActive && (
                  <Link
                    href={`/outreach/${link.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    Preview form
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="p-8">
          <EmptyState icon="share" title="Create your first outreach link">
            Personal links assign new people to you. Branch links let the team
            share responsibility for follow-up.
          </EmptyState>
        </Card>
      )}
      {links.length === 200 && (
        <p className="text-sm text-[#6b6b6b]">Showing the latest 200 links.</p>
      )}
    </Shell>
  );
}
