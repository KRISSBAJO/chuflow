"use client";

import { useTranslations } from "next-intl";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

export function AuthHeading({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="mb-9">
      <h1 className="lp-heading text-[2.25rem] leading-[1.05] sm:text-[2.6rem]">{title}</h1>
      {body ? <p className="mt-3 text-[16px] leading-[1.6] text-[var(--lp-muted)]">{body}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  aside,
  children,
}: {
  label: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-[var(--lp-ink)]">{label}</span>
        {aside}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[13px] text-[var(--lp-muted)]">{hint}</span> : null}
    </label>
  );
}

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <input {...props} type={visible ? "text" : "password"} className="lp-input pr-12" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
          {visible ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10 10 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3.2 4.2M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 004.5-1.1" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function SubmitButton({
  loading,
  disabled,
  loadingLabel,
  children,
}: {
  loading?: boolean;
  disabled?: boolean;
  loadingLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="lp-pill-dark group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        <>
          {children}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </>
      )}
    </button>
  );
}

const ALERT_TONES = {
  error: "bg-red-50 text-red-800",
  success: "bg-emerald-50 text-emerald-800",
  info: "bg-amber-50 text-amber-900",
};

export function Alert({ tone, children }: { tone: keyof typeof ALERT_TONES; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3.5 text-[14px] leading-[1.5] ${ALERT_TONES[tone]}`}>
      {children}
    </div>
  );
}
