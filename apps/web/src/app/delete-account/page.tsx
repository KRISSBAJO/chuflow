import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { buttonClass } from "@/components/ui/ui";
import { getServerSessionUser } from "@/lib/auth";
import { DeletionForm } from "./deletion-form";

export default async function DeleteAccountPage() {
  const [user, t, common] = await Promise.all([
    getServerSessionUser(), getTranslations("auth.accountDeletion"), getTranslations("common"),
  ]);

  return (
    <div className="lp-root min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="ChuFlow"><Wordmark size={22} /></Link>
        <LanguagePicker />
      </header>
      <main className="mx-auto max-w-xl space-y-5 px-6 py-12 sm:py-20">
        <h1 className="lp-heading text-4xl">{t("title")}</h1>
        <p className="text-[var(--lp-muted)]">{t("body")}</p>
        {user ? (
          <>
            <p className="font-semibold">{user.workspace?.name}</p>
            <DeletionForm />
          </>
        ) : (
          <>
            <p>{t("signInHelp")}</p>
            <Link href="/login?returnTo=%2Fdelete-account" className={buttonClass("primary", "md")}>{common("signIn")}</Link>
          </>
        )}
      </main>
    </div>
  );
}
