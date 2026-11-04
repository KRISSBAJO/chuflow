import { notFound } from "next/navigation";
import { API_URL } from "@/lib/api";
import { formLanguage } from "@/lib/form-language";
import {
  OutreachPublicView,
  type PublicOutreachInfo,
} from "@/components/evangelism/public-view";

export const metadata = {
  title: "Connect with the church | ChuFlow",
  robots: { index: false, follow: false },
};

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
  if (!response.ok)
    throw new Error(
      "The connection form is temporarily unavailable. Please try again shortly.",
    );
  const info = (await response.json()) as PublicOutreachInfo;
  const { lang } = await searchParams;
  return (
    <OutreachPublicView
      token={token}
      info={info}
      initialLanguage={formLanguage(lang)}
    />
  );
}
