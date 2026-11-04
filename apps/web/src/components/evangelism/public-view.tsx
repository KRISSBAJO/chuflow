"use client";
import { useState, type CSSProperties } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { FormLanguagePicker } from "@/components/form-language-picker";
import { OutreachContactForm } from "./contact-form";
import { validFormColor, formTextColor } from "@/lib/form-colors";
import {
  formText,
  setFormLanguageInUrl,
  type FormLanguage,
} from "@/lib/form-language";

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
  initialLanguage,
}: {
  token: string;
  info: PublicOutreachInfo;
  initialLanguage: FormLanguage;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const t = (value: string) => formText(value, language);
  const headerColor = validFormColor(info.headerColor);
  const headerText =
    validFormColor(info.headerTextColor) ||
    (headerColor ? formTextColor(headerColor) : undefined);
  const churchName = info.churchName || info.branchName;
  return (
    <div
      lang={language}
      className="app-root min-h-screen bg-[#faf9f6] px-4 py-8 sm:py-12"
    >
      <main className="mx-auto max-w-2xl">
        <div className="mb-5 flex justify-end">
          <FormLanguagePicker
            value={language}
            onChange={(value) => {
              setLanguage(value);
              setFormLanguageInUrl(value);
            }}
          />
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
            {t("Let’s stay connected.")}
          </h1>
          <p
            className="mb-7 mt-4 text-base leading-7"
            style={{ color: headerText || "#6b6b6b" }}
          >
            {t(
              "It was a pleasure connecting with you. Leave your details so our team can follow up, pray with you, or help you take your next step.",
            )}
          </p>
        </header>
        <OutreachContactForm
          token={token}
          branchName={churchName}
          buttonColor={info.buttonColor}
          buttonTextColor={info.buttonTextColor}
          language={language}
        />
        <p className="mt-6 text-center text-xs leading-6 text-[#8a8780]">
          {t(
            "Your details go to this church’s care team. You do not need a ChuFlow account.",
          )}
        </p>
      </main>
    </div>
  );
}
