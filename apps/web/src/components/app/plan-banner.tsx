"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui/ui";
import type { SessionUser } from "@/lib/auth";
import { planState } from "@/lib/entitlements";

/*
 * Tells the church where its plan stands: a slim banner while a trial or grace period runs,
 * a read-only notice when payment is overdue, and a full-page stop when the workspace is
 * locked. Renders nothing when no plan is enforced.
 */
export function PlanBanner({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  const t = useTranslations("common.plan");
  const format = useFormatter();
  const entitlements = user?.entitlements;
  const state = planState(entitlements);
  if (!state || !entitlements) return <>{children}</>;

  const date = (value?: string) => (value ? format.dateTime(new Date(value), { dateStyle: "medium" }) : "");

  if (state.kind === "locked") {
    const why =
      state.reason === "suspended"
        ? t("lockedSuspended")
        : state.reason === "cancelled"
          ? t("lockedCancelled")
          : state.reason === "trial_ended"
            ? t("lockedTrialEnded")
            : t("lockedOverdue");
    return (
      <div className="app-rise mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </span>
        <h1 className="lp-heading text-[1.8rem] leading-tight">{t("lockedTitle")}</h1>
        <p className="text-[15px] leading-[1.6] text-[#6b6b6b]">
          {why} {t("lockedBody")}
        </p>
        <Link href="/plan" className={buttonClass("secondary")}>
          {t("viewPlan")}
        </Link>
      </div>
    );
  }

  const tone = state.kind === "trial" ? "bg-amber-50 text-amber-900" : state.kind === "past_due" ? "bg-orange-50 text-orange-900" : "bg-red-50 text-red-800";
  const title =
    state.kind === "trial"
      ? t("trialTitle", { days: state.days, plan: entitlements.planName })
      : state.kind === "past_due"
        ? t("pastDueTitle", { plan: entitlements.planName })
        : t("readOnlyTitle");
  const body = state.kind === "trial" ? t("trialBody") : state.kind === "past_due" ? t("pastDueBody", { date: date(state.until) }) : t("readOnlyBody");

  return (
    <>
      <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-[14px] leading-[1.5] ${tone}`}>
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{title}</span> <span className="opacity-90">{body}</span>
        </p>
        <Link href="/plan" className="shrink-0 text-[13px] font-medium underline underline-offset-4">
          {t("viewPlan")}
        </Link>
      </div>
      {children}
    </>
  );
}
