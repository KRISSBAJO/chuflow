import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { YouthRegistrationForm } from "@/components/youth/youth-registration";
import { workspaceApiContext, workspaceId } from "@/lib/workspace-routing";

export async function generateMetadata() {
  const t = await getTranslations("youth");
  return { title: t("registration"), robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}
export default async function Page({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { token } = await params;
  const { workspace } = await searchParams;
  const scope = workspaceId(workspace);
  if (!/^[a-f0-9]{48}$/.test(token) || (workspace && !scope)) notFound();
  return <main className="mx-auto max-w-2xl space-y-8 px-5 py-8 sm:py-14">
    <header className="flex items-center justify-between gap-3"><span className="text-xl font-bold">ChuFlow</span><LanguagePicker /></header>
    <YouthRegistrationForm token={token} apiBase={workspaceApiContext(scope).base} />
  </main>;
}
