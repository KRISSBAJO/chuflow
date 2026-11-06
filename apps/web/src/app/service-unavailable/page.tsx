import { getTranslations } from "next-intl/server";
import { BackendWakeup } from "@/components/backend-wakeup";
import { safeReturnTo } from "@/lib/return-to";
import { LanguagePicker } from "@/components/i18n/language-picker";

export default async function ServiceUnavailablePage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const [t, params] = await Promise.all([getTranslations("recording"), searchParams]);
  return <main className="mx-auto max-w-xl px-5 py-16 sm:py-24"><header className="flex items-center justify-between gap-4"><p className="text-sm font-semibold">ChuFlow</p><LanguagePicker /></header><h1 className="mt-8 text-3xl font-semibold tracking-tight">{t("serverTitle")}</h1><p className="mt-4 leading-7 text-[#6b6b6b]">{t("serverBody")}</p><BackendWakeup returnTo={safeReturnTo(params.returnTo)} /></main>;
}
