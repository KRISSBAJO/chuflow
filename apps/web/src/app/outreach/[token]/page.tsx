import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { workspaceApiContext, workspaceId } from "@/lib/workspace-routing";
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
  searchParams: Promise<{ lang?: string; workspace?: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const { lang, workspace } = await searchParams;
  const scope = workspaceId(workspace);
  if (workspace && !scope) notFound();
  const apiBase = workspaceApiContext(scope).base;
  const response = await fetch(`${apiBase}/evangelism/public/${token}`, {
    cache: "no-store",
  });
  if (response.status === 404) notFound();
  if (!response.ok) {
    const t = await getTranslations("people.evangelism.publicView");
    throw new Error(t("unavailable"));
  }
  const info = (await response.json()) as PublicOutreachInfo;
  return <OutreachPublicView token={token} info={info} apiBase={apiBase} requestedLanguage={lang} />;
}
