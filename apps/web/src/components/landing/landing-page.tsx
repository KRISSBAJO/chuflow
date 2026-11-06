import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageRow } from "@/components/i18n/language-picker";
import { LandingFlow } from "./landing-flow";
import { landingFont } from "./landing-font";
import { LandingHero } from "./landing-hero";
import { unsplash } from "./landing-images";
import { Reveal } from "./landing-motion";
import { ArrowRight, LandingNav, Logo } from "./landing-nav";
import { LandingStructure } from "./landing-structure";

const BARS = [46, 58, 52, 64, 60, 72, 68, 86];

function InlinePhoto({ id, alt }: { id: string; alt: string }) {
  return (
    <span className="relative mx-[0.12em] inline-block h-[0.82em] w-[1.6em] -translate-y-[0.06em] overflow-hidden rounded-full align-middle">
      <Image src={unsplash(id, 300)} alt={alt} fill unoptimized sizes="120px" className="object-cover" />
    </span>
  );
}

async function Statement() {
  const t = await getTranslations("statement");

  return (
    <section className="py-28 sm:py-40">
      <Reveal className="mx-auto max-w-[1100px] px-5 text-center sm:px-8">
        <p className="lp-heading text-[2rem] leading-[1.18] sm:text-[3.25rem] lg:text-[4rem]">
          {t.rich("text", {
            p1: () => <InlinePhoto id="1778824717521-a23599f32d71" alt={t("alt1")} />,
            p2: () => <InlinePhoto id="1739301674016-45dddb02e2dd" alt={t("alt2")} />,
            p3: () => <InlinePhoto id="1542296120-cd8d3eb196d5" alt={t("alt3")} />,
            muted: (chunks) => <span className="text-black/30">{chunks}</span>,
          })}
        </p>
      </Reveal>
    </section>
  );
}

function Check() {
  return (
    <span className="lp-flame-bg flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function CardHeading({ label, title }: { label: string; title: string }) {
  return (
    <>
      <p className="text-[13px] font-medium text-[var(--lp-muted)]">{label}</p>
      <h3 className="lp-heading mt-3 text-[26px] leading-[1.1] sm:text-[30px]">{title}</h3>
    </>
  );
}

async function Features() {
  const t = await getTranslations("features");
  const guestPoints = [t("guests.point1"), t("guests.point2"), t("guests.point3")];
  const financeRows = [
    [t("finance.offerings"), t("finance.recorded")],
    [t("finance.expenses"), t("finance.approved")],
    [t("finance.period"), t("finance.locked")],
  ];
  const reportChips = [t("reports.weekly"), t("reports.monthly"), t("reports.maag"), t("reports.spiritualIndices"), t("reports.branchToNational")];

  return (
    <section id="features" className="scroll-mt-20 py-28 sm:py-36">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="lp-label">{t("label")}</p>
            <h2 className="lp-heading mt-4 max-w-[640px] text-[2.5rem] leading-[1.05] sm:text-[3.75rem]">{t("title")}</h2>
          </div>
          <p className="max-w-[380px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{t("subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-5">
          <Reveal className="lg:col-span-2">
            <div className="lp-card grid h-full overflow-hidden sm:grid-cols-2">
              <div className="p-8 sm:p-10">
                <CardHeading label={t("guests.label")} title={t("guests.title")} />
                <ul className="mt-8 space-y-3.5">
                  {guestPoints.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[15px] text-[var(--lp-ink)]">
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative min-h-[280px] sm:min-h-0">
                <Image
                  src={unsplash("1614317354806-860a3bf79069", 1000)}
                  alt={t("guests.photoAlt")}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 400px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="lp-card flex h-full flex-col p-8 sm:p-10">
              <CardHeading label={t("attendance.label")} title={t("attendance.title")} />
              <div className="mt-10 flex h-36 flex-1 items-end gap-2">
                {BARS.map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className={`lp-bar w-full rounded-full ${index === BARS.length - 1 ? "lp-flame-bg" : "bg-black/[0.08]"}`}
                      style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-[var(--lp-muted)]">{t("attendance.caption")}</p>
            </div>
          </Reveal>

          <Reveal>
            <div className="lp-card h-full p-8 sm:p-10">
              <CardHeading label={t("members.label")} title={t("members.title")} />
              <p className="mt-4 text-[15px] leading-[1.6] text-[var(--lp-muted)]">{t("members.body")}</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="lp-card h-full p-8 sm:p-10">
              <CardHeading label={t("finance.label")} title={t("finance.title")} />
              <div className="mt-7 space-y-2">
                {financeRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[14px]">
                    <span className="text-[var(--lp-muted)]">{label}</span>
                    <span className="font-medium text-[var(--lp-ink)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="lp-card h-full p-8 sm:p-10">
              <CardHeading label={t("reports.label")} title={t("reports.title")} />
              <div className="mt-7 flex flex-wrap gap-2">
                {reportChips.map((chip) => (
                  <span key={chip} className="rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-[var(--lp-ink)]">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

async function FinalCta({ tagline }: { tagline: string }) {
  const t = await getTranslations("cta");
  const tc = await getTranslations("common");

  return (
    <section id="get-started" className="scroll-mt-20 px-3 pb-6 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[40px] bg-[var(--lp-panel)] px-6 py-24 text-center sm:py-32">
          <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-10 h-40 w-full opacity-70" aria-hidden>
            <path d="M0 150 C 300 40, 520 190, 760 110 S 1200 30, 1440 90" fill="none" stroke="url(#lp-cta-line)" strokeWidth={2} className="lp-ribbon-loop" pathLength={1} />
            <defs>
              <linearGradient id="lp-cta-line" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0" />
                <stop offset="50%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative">
            <p className="lp-label">{tagline}</p>
            <h2 className="lp-heading mx-auto mt-5 max-w-[760px] text-[2.75rem] leading-[1.02] sm:text-[4.5rem]">{t("title")}</h2>
            <p className="mx-auto mt-6 max-w-[440px] text-[17px] leading-[1.6] text-[var(--lp-muted)]">{t("body")}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/request-workspace" className="lp-pill-dark group inline-flex h-[52px] items-center gap-2 rounded-full pl-6 pr-5 text-[15px] font-medium">
                {tc("requestWorkspace")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className="inline-flex h-[52px] items-center rounded-full bg-white px-6 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-white/70">
                {tc("signIn")}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

async function Footer() {
  const t = await getTranslations();
  const links = [
    { label: t("nav.howItFlows"), href: "#flow" },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.structure"), href: "#structure" },
    { label: t("footer.connect"), href: "/connect" },
    { label: t("footer.requestWorkspace"), href: "/request-workspace" },
    { label: t("common.signIn"), href: "/login" },
  ];

  return (
    <footer className="overflow-hidden pt-16">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-7 gap-y-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-[14px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-ink)]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-5 border-t border-black/[0.06] pt-6 text-[13px] text-[var(--lp-muted)] md:flex-row md:items-center md:justify-between">
          <p>{t("common.copyright", { year: new Date().getFullYear() })}</p>
          <LanguageRow showLabel />
          <p>{t("footer.tagline")}</p>
        </div>
      </div>
      <p aria-hidden className="lp-wordmark mt-6 select-none text-center text-[23vw] leading-[0.78]">
        ChuFlow
      </p>
    </footer>
  );
}

export function LandingPage({ tagline, signedIn = false, firstName, workspaceHref = "/dashboard" }: { tagline: string; signedIn?: boolean; firstName?: string; workspaceHref?: string }) {
  return (
    <div className={`${landingFont.variable} lp-root min-h-screen w-full overflow-x-clip`}>
      <noscript>
        <style>{`.lp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <LandingNav signedIn={signedIn} firstName={firstName} workspaceHref={workspaceHref} />
      <main>
        <LandingHero signedIn={signedIn} workspaceHref={workspaceHref} />
        <Statement />
        <LandingFlow />
        <Features />
        <LandingStructure />
        <FinalCta tagline={tagline} />
      </main>
      <Footer />
    </div>
  );
}
