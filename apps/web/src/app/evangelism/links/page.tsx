import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { OutreachLinkToggle } from "@/components/evangelism/link-form";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Badge, buttonClass, Card, EmptyState } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { workspacePublicHref } from "@/lib/workspace-routing";
import { outreachName, type OutreachLink } from "@/lib/evangelism";

export default async function OutreachLinksPage() {
  const user = await requireServerRole("/evangelism");
  const [t, tsh] = await Promise.all([getTranslations("people.evangelism.links"), getTranslations("people.shared")]);
  const links = await serverGet<OutreachLink[]>("/evangelism/links");
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL || "https://www.chuflow.com"
  ).replace(/\/$/, "");
  return (
    <Shell>
      <Link href="/evangelism" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/evangelism/links/new" className={buttonClass("primary")}>
            {t("create")}
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
                  {link.isActive ? t("active") : t("paused")}
                </Badge>
              </div>
              <p className="text-sm text-[#6b6b6b]">
                {link.branchId?.name} ·{" "}
                {link.kind === "personal"
                  ? t("personalLink", { owner: outreachName(link.ownerId, tsh("unassigned")) })
                  : t("branchLink")}
              </p>
              <p className="text-sm font-medium">
                {t("connected", { count: link.contactCount })}
              </p>
              {link.isActive ? (
                <TemplateQrCard
                  allowSpanish
                  url={origin + workspacePublicHref(`/outreach/${link.token}`, user.workspace?.id)}
                  title={link.name}
                />
              ) : (
                <p className="rounded-xl bg-white p-4 text-sm">
                  {t("pausedNote")}
                </p>
              )}
              <p className="text-sm text-[#6b6b6b]">
                {t("churchShown", { name: link.churchName || link.branchId?.name || "" })}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/evangelism/links/${link._id}/edit`}
                  className={buttonClass("secondary", "sm")}
                >
                  {t("edit")}
                </Link>
                <OutreachLinkToggle id={link._id} active={link.isActive} />
                {link.isActive && (
                  <Link
                    href={workspacePublicHref(`/outreach/${link.token}`, user.workspace?.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    {t("preview")}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="p-8">
          <EmptyState icon="share" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        </Card>
      )}
      {links.length === 200 && (
        <p className="text-sm text-[#6b6b6b]">{t("showingLatest")}</p>
      )}
    </Shell>
  );
}
