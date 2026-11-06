import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL } from "@/lib/api";
import {
  OutreachPublicView,
  type PublicOutreachInfo,
} from "@/components/evangelism/public-view";

export async function generateMetadata() {
  const t = await getTranslations("people.evangelism.publicView");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function PublicOutreachPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const response = await fetch(`${API_URL}/evangelism/public/${token}`, {
    cache: "no-store",
  });
  if (response.status === 404) notFound();
  if (!response.ok) {
    const t = await getTranslations("people.evangelism.publicView");
    throw new Error(t("unavailable"));
  }
  const info = (await response.json()) as PublicOutreachInfo;
  const { lang } = await searchParams;
  return <OutreachPublicView token={token} info={info} requestedLanguage={lang} />;
}
