import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { Badge, Card, CardHeader, type BadgeTone } from "@/components/ui/ui";
import { requireServerSession } from "@/lib/auth";
import { FEATURE_KEYS, QUOTA_KEYS } from "@/lib/ops/types";

const TONES: Record<string, BadgeTone> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  delinquent: "danger",
  suspended: "danger",
  cancelled: "danger",
  full: "success",
  read_only: "warning",
  locked: "danger",
};

/** The church's view of its own plan: what is included, what the limits are and when it renews. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const [user, params, t, format] = await Promise.all([requireServerSession(), searchParams, getTranslations("common.plan"), getFormatter()]);
  const entitlements = user.entitlements;
  const date = (value?: string) => (value ? format.dateTime(new Date(value), { dateStyle: "medium" }) : "—");

  return (
    <Shell>
      <PageHeader eyebrow={t("page.label")} title={t("page.title")} description={entitlements?.enforced ? t("page.body") : t("page.notEnforced")} />
      {params.blocked ? (
        <div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3.5 text-[14px] leading-[1.5] text-amber-900">
          {t("page.blocked")}
        </div>
      ) : null}
      {entitlements?.enforced ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <CardHeader
              title={entitlements.planName}
              action={
                <>
                  <Badge tone={TONES[entitlements.status] ?? "neutral"} dot>
                    {t(`statuses.${entitlements.status}`)}
                  </Badge>
                  <Badge tone={TONES[entitlements.access] ?? "neutral"}>{t(`access.${entitlements.access}`)}</Badge>
                </>
              }
            />
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-medium text-[#8a8780]">{t("page.trialEnds")}</dt>
                <dd className="mt-0.5">{date(entitlements.trialEndsAt)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-[#8a8780]">{t("page.paidThrough")}</dt>
                <dd className="mt-0.5">{date(entitlements.currentPeriodEnd)}</dd>
              </div>
              {entitlements.graceEndsAt ? (
                <div>
                  <dt className="text-[12px] font-medium text-[#8a8780]">{t("page.graceEnds")}</dt>
                  <dd className="mt-0.5">{date(entitlements.graceEndsAt)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-5 text-[14px] leading-[1.6] text-[#6b6b6b]">{t("page.contact")}</p>
          </Card>
          <Card className="p-5 sm:p-6">
            <CardHeader title={t("page.quotas")} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {QUOTA_KEYS.map((key) => (
                <div key={key} className="rounded-2xl bg-[#f6f5f1] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#6b6b6b]">{t(`quotas.${key}`)}</p>
                  <p className="mt-1 text-[20px] font-semibold leading-none tabular-nums">{entitlements.quotas[key] === null ? t("page.unlimited") : entitlements.quotas[key]}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <CardHeader title={t("page.features")} />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_KEYS.map((key) => {
                const on = entitlements.features.includes(key);
                return (
                  <li key={key} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[14px] ${on ? "bg-emerald-50 text-emerald-900" : "bg-[#f6f5f1] text-[#8a8780]"}`}>
                    <span>{t(`features.${key}`)}</span>
                    <span className="text-[12px] font-medium">{on ? t("page.included") : t("page.notIncluded")}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}
    </Shell>
  );
}
