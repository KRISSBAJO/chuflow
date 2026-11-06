import Link from "next/link";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/app/icons";
import { buttonClass } from "@/components/ui/ui";
import { useTranslations } from "next-intl";

export function CreatePage({ title, backHref, children }: { title: string; backHref: string; children: ReactNode }) {
  const t = useTranslations("common");
  return <Shell>
    <Link href={backHref} className={buttonClass("secondary", "sm")}><Icon name="arrowLeft" /> {t("back")}</Link>
    <PageHeader eyebrow={t("createEyebrow")} title={title} description={t("completeDetails")} />
    <div className="mx-auto w-full max-w-4xl space-y-6">{children}</div>
  </Shell>;
}
