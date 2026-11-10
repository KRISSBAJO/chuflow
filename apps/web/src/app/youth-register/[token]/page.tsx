import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { YouthRegistrationForm } from "@/components/youth/youth-registration";
import { GuardianUnsubscribe } from "@/components/youth/guardian-reminder";
import { MentoringConsentForm } from "@/components/youth/mentoring-email";
import { workspaceApiContext, workspaceId } from "@/lib/workspace-routing";

export async function generateMetadata() {
  const t = await getTranslations("youth");
  return { title: t("registration"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}
export default async function Page({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ workspace?: string; unsubscribe?: string; mentoring?: string }>;
}) {
  const { token } = await params;
  const { workspace, unsubscribe, mentoring } = await searchParams;
  const scope = workspaceId(workspace);
  const mentoringPreference = mentoring === "on" || mentoring === "off";
  if (!(mentoringPreference ? /^[a-f0-9]{88}$/ : /^[a-f0-9]{48}$/).test(token) || (workspace && !scope)) notFound();
  const apiBase = workspaceApiContext(scope).base;
  return <main className="mx-auto max-w-2xl space-y-8 px-5 py-8 sm:py-14">
    <header className="flex items-center justify-between gap-3"><span className="text-xl font-bold">ChuFlow</span><LanguagePicker /></header>
    {mentoringPreference ? <MentoringConsentForm token={token} apiBase={apiBase} enabled={mentoring === "on"} /> :
      unsubscribe === "1" ? <GuardianUnsubscribe token={token} apiBase={apiBase} /> : <YouthRegistrationForm token={token} apiBase={apiBase} />}
  </main>;
}
