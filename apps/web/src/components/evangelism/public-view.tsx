"use client";
import { useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguageRow } from "@/components/i18n/language-picker";
import { setLocaleAction } from "@/i18n/actions";
import { isLocale } from "@/i18n/config";
import { OutreachContactForm } from "./contact-form";
import { validFormColor, formTextColor } from "@/lib/form-colors";

export type PublicOutreachInfo = {
  branchName: string;
  churchName?: string;
  headerColor?: string;
  buttonColor?: string;
  headerTextColor?: string;
  buttonTextColor?: string;
};
export function OutreachPublicView({
  token,
  info,
  requestedLanguage,
}: {
  token: string;
  info: PublicOutreachInfo;
  /** `?lang=` from a shared or QR link; applied once to the language cookie, then dropped from the URL. */
  requestedLanguage?: string;
}) {
  const t = useTranslations("people.evangelism.publicView");
  const locale = useLocale();
  const router = useRouter();
  useEffect(() => {
    if (!requestedLanguage) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", url.toString());
    if (isLocale(requestedLanguage) && requestedLanguage !== locale) {
      void setLocaleAction(requestedLanguage).then(() => router.refresh());
    }
  }, [requestedLanguage, locale, router]);
  const headerColor = validFormColor(info.headerColor);
  const headerText =
    validFormColor(info.headerTextColor) ||
    (headerColor ? formTextColor(headerColor) : undefined);
  const churchName = info.churchName || info.branchName;
  return (
    <div
      lang={locale}
      className="app-root min-h-screen bg-[#faf9f6] px-4 py-8 sm:py-12"
    >
      <main className="mx-auto max-w-2xl">
        <div className="mb-5 flex justify-end">
          <LanguageRow />
        </div>
        <header
          style={
            headerColor || headerText
              ? ({
                  backgroundColor: headerColor,
                  color: headerText,
                  padding: 24,
                  borderRadius: 20,
                  marginBottom: 24,
                  "--lp-ink": headerText,
                  "--lp-muted": headerText,
                } as CSSProperties)
              : undefined
          }
        >
          <Wordmark size={26} />
          <p className="mt-8 break-words text-xl font-semibold">{churchName}</p>
          {churchName !== info.branchName && (
            <p
              className="mt-1 text-sm"
              style={{ color: headerText || "#8a8780" }}
            >
              {info.branchName}
            </p>
          )}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p
            className="mb-7 mt-4 text-base leading-7"
            style={{ color: headerText || "#6b6b6b" }}
          >
            {t("intro")}
          </p>
        </header>
        <OutreachContactForm
          token={token}
          branchName={churchName}
          buttonColor={info.buttonColor}
          buttonTextColor={info.buttonTextColor}
        />
        <p className="mt-6 text-center text-xs leading-6 text-[#8a8780]">
          {t("footer")}
        </p>
      </main>
    </div>
  );
}
