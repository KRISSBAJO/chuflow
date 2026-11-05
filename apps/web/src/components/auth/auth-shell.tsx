import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { unsplash } from "@/components/landing/landing-images";

type AuthShellProps = {
  children: ReactNode;
  /** Small prompt in the top-right corner, e.g. "New to ChuFlow?" + link. */
  switchPrompt?: { text: string; label: string; href: string };
  aside: {
    photoId: string;
    photoAlt: string;
    title: string;
    body?: string;
    points?: string[];
  };
  /** Wider form column for longer forms. */
  wide?: boolean;
};

export async function AuthShell({ children, switchPrompt, aside, wide = false }: AuthShellProps) {
  const t = await getTranslations("common");

  return (
    <div className="lp-root flex min-h-screen w-full bg-white">
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-20 items-center justify-between gap-4 px-6 sm:px-10">
          <Wordmark size={22} />
          <div className="flex items-center gap-3">
            {switchPrompt ? (
              <p className="text-[14px] text-[var(--lp-muted)]">
                <span className="hidden sm:inline">{switchPrompt.text} </span>
                <Link href={switchPrompt.href} className="font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline">
                  {switchPrompt.label}
                </Link>
              </p>
            ) : null}
            <LanguagePicker />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className={`lp-rise w-full ${wide ? "max-w-[560px]" : "max-w-[400px]"}`}>{children}</div>
        </main>

        <footer className="flex items-center justify-between gap-4 px-6 py-6 text-[13px] text-[var(--lp-muted)] sm:px-10">
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <Link href="/" className="transition-colors hover:text-[var(--lp-ink)]">
            {t("backToHome")}
          </Link>
        </footer>
      </div>

      <aside className="sticky top-0 hidden h-screen w-[46%] max-w-[760px] shrink-0 p-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-[32px] bg-[var(--lp-panel)]">
          <Image src={unsplash(aside.photoId, 1600)} alt={aside.photoAlt} fill unoptimized preload sizes="46vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-[46%] h-32 w-full" aria-hidden>
            <defs>
              <linearGradient id="lp-auth-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 140 C 160 40, 300 190, 460 100 S 700 40, 800 80"
              fill="none"
              stroke="url(#lp-auth-line)"
              strokeWidth={2.5}
              pathLength={1}
              className="lp-ribbon-loop"
            />
          </svg>

          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-12">
            <h2 className="lp-heading max-w-[460px] text-[2.5rem] leading-[1.04] xl:text-[3rem]" style={{ color: "#fff" }}>
              {aside.title}
            </h2>
            {aside.body ? <p className="mt-4 max-w-[420px] text-[16px] leading-[1.6] text-white/75">{aside.body}</p> : null}
            {aside.points?.length ? (
              <ul className="mt-7 flex flex-wrap gap-2">
                {aside.points.map((point) => (
                  <li key={point} className="rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-md">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Centered single-message page (404, no access, unavailable). */
export function StatusShell({
  label,
  title,
  body,
  actions,
}: {
  label: string;
  title: string;
  body: string;
  actions: { label: string; href: string; primary?: boolean }[];
}) {
  return (
    <div className="lp-root relative flex min-h-screen w-full flex-col overflow-hidden bg-white">
      <header className="flex h-20 items-center justify-between px-6 sm:px-10">
        <Wordmark size={22} />
        <LanguagePicker />
      </header>

      <svg viewBox="0 0 1440 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-[58%] h-48 w-full opacity-80" aria-hidden>
        <defs>
          <linearGradient id="lp-status-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 200 C 300 60, 520 280, 760 150 S 1200 60, 1440 130"
          fill="none"
          stroke="url(#lp-status-line)"
          strokeWidth={2.5}
          pathLength={1}
          className="lp-ribbon-loop"
        />
      </svg>

      <main className="relative flex flex-1 items-center justify-center px-6 pb-24 text-center">
        <div className="lp-rise max-w-[640px]">
          <p className="lp-label">{label}</p>
          <h1 className="lp-heading mt-5 text-[2.75rem] leading-[1.04] sm:text-[4rem]">{title}</h1>
          <p className="mx-auto mt-5 max-w-[480px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{body}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={
                  action.primary
                    ? "lp-pill-dark inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium"
                    : "inline-flex h-12 items-center rounded-full bg-[var(--lp-panel)] px-6 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#ecebe7]"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
