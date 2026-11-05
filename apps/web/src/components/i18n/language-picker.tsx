"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocaleAction } from "@/i18n/actions";
import { LOCALES, type Locale } from "@/i18n/config";

function GlobeIcon({ className = "h-[15px] w-[15px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

function useLocaleSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) {
      return;
    }
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return { locale, pending, switchTo };
}

/** Compact globe + language code button that opens a menu. Used in page headers. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const t = useTranslations("locale");
  const { locale, pending, switchTo } = useLocaleSwitch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t("label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium uppercase tracking-[0.04em] text-[var(--lp-muted)] transition-colors hover:bg-[var(--lp-panel)] hover:text-[var(--lp-ink)] ${pending ? "opacity-60" : ""}`}
      >
        <GlobeIcon />
        {locale}
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("label")}
          className="absolute right-0 top-full z-50 mt-2 min-w-[168px] rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(17,17,17,0.25)]"
        >
          {LOCALES.map((code) => {
            const selected = code === locale;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    switchTo(code);
                  }}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left text-[14px] transition-colors ${selected ? "bg-[var(--lp-panel)] font-medium text-[var(--lp-ink)]" : "text-[var(--lp-ink)] hover:bg-[var(--lp-panel)]"}`}
                >
                  {t(code)}
                  {selected ? <span className="lp-flame-bg h-1.5 w-1.5 rounded-full" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** All languages in a row of pills. Used in the mobile menu and footers. */
export function LanguageRow({ className = "" }: { className?: string }) {
  const t = useTranslations("locale");
  const { locale, pending, switchTo } = useLocaleSwitch();

  return (
    <div role="group" aria-label={t("label")} className={`flex flex-wrap items-center gap-1.5 ${className} ${pending ? "opacity-60" : ""}`}>
      <GlobeIcon className="mr-1 h-4 w-4 text-[var(--lp-muted)]" />
      {LOCALES.map((code) => {
        const selected = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            onClick={() => switchTo(code)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${selected ? "bg-[var(--lp-ink)] text-white" : "bg-[var(--lp-panel)] text-[var(--lp-ink)] hover:bg-[#ecebe7]"}`}
          >
            {t(code)}
          </button>
        );
      })}
    </div>
  );
}
