import { ActionNotice } from "@/components/action-notice";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireServerRole("/approvals/routes");
  const t = await getTranslations("admin.approvalRoutes");
  const tr = await getTranslations("admin.approvalRequests");
  const ts = await getTranslations("statuses");
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  const q = await searchParams;
  return (
    <Shell>
      <Link href="/approvals/requests" className="text-sm hover:underline">
        {tr("backToRequests")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/approvals/routes/new" className={buttonClass("primary")}>
            {t("newRoute")}
          </Link>
        }
      />
      {q.saved && <ActionNotice param="saved" message={t("saved")} />}
      <div className="grid gap-4 md:grid-cols-2">
        {data.policies.map((p) => (
          <Link key={p._id} href={`/approvals/routes/${p._id}`}>
            <Card className="h-full p-5 transition hover:ring-1 hover:ring-orange-300">
              <p className="text-xs uppercase text-[#b95c18]">
                {p.category} · {p.isActive ? ts("active") : ts("inactive")}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{p.name} →</h2>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                {t("summary", {
                  region: p.oversightRegion,
                  level: tr(`level.${p.finalLevel}`),
                  days: p.reviewDays,
                })}
              </p>
              {p.thresholdAmount !== undefined && (
                <p className="mt-2 text-sm">
                  {t("aboveThreshold", {
                    currency: p.currency,
                    amount: p.thresholdAmount,
                    level: p.aboveThresholdLevel
                      ? tr(`level.${p.aboveThresholdLevel}`)
                      : "",
                  })}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
      {!data.policies.length && (
        <Card className="p-8 text-sm">{t("none")}</Card>
      )}
    </Shell>
  );
}
