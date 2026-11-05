"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguagePicker, LanguageRow } from "@/components/i18n/language-picker";

const NAV_LINKS = [
  { href: "#flow", key: "howItFlows" },
  { href: "#features", key: "features" },
  { href: "#structure", key: "structure" },
] as const;

export function ArrowRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Logo() {
  return <Wordmark size={22} />;
}

export function LandingNav({ signedIn = false, firstName, workspaceHref = "/dashboard" }: { signedIn?: boolean; firstName?: string; workspaceHref?: string }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accountLabel = signedIn ? firstName || tc("myAccount") : tc("signIn");
  const primaryLabel = signedIn ? tc("openWorkspace") : t("getStarted");

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b bg-white/90 backdrop-blur-lg transition-colors duration-300 ${scrolled || open ? "border-black/[0.06]" : "border-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8">
        <Logo />

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-[14px] font-medium text-[var(--lp-muted)] transition-colors hover:bg-[var(--lp-panel)] hover:text-[var(--lp-ink)]"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguagePicker className="hidden sm:block" />
          <Link
            href={signedIn ? "/settings" : "/login"}
            className="hidden rounded-full px-4 py-2 text-[14px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[var(--lp-panel)] sm:block"
          >
            {accountLabel}
          </Link>
          <Link href={signedIn ? workspaceHref : "/request-workspace"} className="lp-pill-dark hidden h-10 items-center rounded-full px-5 text-[14px] font-medium sm:inline-flex">
            {primaryLabel}
          </Link>
          <button
            type="button"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lp-panel)] text-[var(--lp-ink)] lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
              {open ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 9h16M4 15h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-black/[0.06] bg-white px-5 pb-5 pt-2 lg:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-black/[0.05] py-4 text-[20px] font-medium tracking-[-0.02em] text-[var(--lp-ink)]"
            >
              {t(link.key)}
            </a>
          ))}
          <LanguageRow className="mt-5" />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href={signedIn ? "/settings" : "/login"} className="flex h-12 items-center justify-center rounded-full bg-[var(--lp-panel)] text-[15px] font-medium text-[var(--lp-ink)]">
              {accountLabel}
            </Link>
            <Link href={signedIn ? workspaceHref : "/request-workspace"} className="lp-pill-dark flex h-12 items-center justify-center rounded-full text-[15px] font-medium">
              {primaryLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
