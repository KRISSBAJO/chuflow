import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { buttonClass } from "@/components/ui/ui";
import { OutreachLinkForm } from "@/components/evangelism/link-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { OutreachLink } from "@/lib/evangelism";

export default async function EditOutreachLink({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/evangelism");
  const t = await getTranslations("people.evangelism.links");
  const { id } = await params;
  const link = await serverGet<OutreachLink>(`/evangelism/links/${id}`);
  return (
    <Shell>
      <Link href="/evangelism/links" className={buttonClass("secondary", "sm")}>
        <Icon name="arrowLeft" /> {t("editBack")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("editTitle")}
        description={t("editDescription")}
      />
      <div className="mx-auto w-full max-w-3xl">
        <OutreachLinkForm branches={[link.branchId]} link={link} />
      </div>
    </Shell>
  );
}
