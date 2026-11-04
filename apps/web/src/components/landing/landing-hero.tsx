import Link from "next/link";
import { HeroMosaic } from "./hero-mosaic";
import { ArrowRight } from "./landing-nav";

export function LandingHero({ signedIn = false, workspaceHref = "/dashboard" }: { signedIn?: boolean; workspaceHref?: string }) {
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="mx-auto max-w-[1240px] px-5 text-center sm:px-8">
        <a
          href="#features"
          className="lp-rise inline-flex items-center gap-2 rounded-full bg-[var(--lp-panel)] py-1.5 pl-1.5 pr-4 text-[13px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#ecebe7]"
        >
          <span className="lp-flame-bg rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white">New</span>
          Weekly and MAAG reports are here
          <ArrowRight className="h-3.5 w-3.5 text-[var(--lp-muted)]" />
        </a>

        <h1
          className="lp-rise lp-heading mx-auto mt-8 max-w-[980px] text-[2.9rem] leading-[1.02] sm:text-[4.75rem] lg:text-[5.75rem]"
          style={{ animationDelay: "100ms" }}
        >
          Every member, every ministry, in one <span className="lp-flame-text">flow.</span>
        </h1>

        <p
          className="lp-rise mx-auto mt-7 max-w-[600px] text-[17px] leading-[1.6] text-[var(--lp-muted)] sm:text-[19px]"
          style={{ animationDelay: "200ms" }}
        >
          ChuFlow is the church management platform for guests, follow-up, members, attendance and finance, built for
          branches, districts and national teams.
        </p>

        <div className="lp-rise mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "300ms" }}>
          <Link href={signedIn ? workspaceHref : "/request-workspace"} className="lp-pill-dark group inline-flex h-[52px] items-center gap-2 rounded-full pl-6 pr-5 text-[15px] font-medium">
            {signedIn ? "Open workspace" : "Request a workspace"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={signedIn ? "/settings" : "/login"}
            className="inline-flex h-[52px] items-center rounded-full bg-[var(--lp-panel)] px-6 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#ecebe7]"
          >
            {signedIn ? "My account" : "Sign in to your church"}
          </Link>
        </div>
      </div>

      <HeroMosaic />
    </section>
  );
}
