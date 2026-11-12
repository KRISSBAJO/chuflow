import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OfferingCustodyPanel, type CustodyView } from "@/components/offering-custody-panel";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { LEADERSHIP_ROLES, type AppRole } from "@/lib/permissions";
import { serverGet, ServerApiError } from "@/lib/server-api";

export default async function OfferingCustodyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const user = await requireServerRole("/finance/offerings/" + id + "/custody");
  if (!LEADERSHIP_ROLES.includes(user.role as AppRole)) redirect("/unauthorized");
  const [custody, t, tc] = await Promise.all([
    serverGet<CustodyView>("/finance/offerings/" + id + "/custody").catch(error => {
      if (error instanceof ServerApiError && error.status === 404) notFound();
      throw error;
    }),
    getTranslations("admin.custody"),
    getTranslations("common"),
  ]);

  return <Shell>
    <Link className={buttonClass("secondary", "sm")} href="/finance?tab=offerings">{tc("back")}</Link>
    <PageHeader eyebrow={t("title")} title={custody.title} description={custody.service} />
    <OfferingCustodyPanel id={id} custody={custody} />
  </Shell>;
}
