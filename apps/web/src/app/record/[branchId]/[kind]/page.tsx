import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireServerSession } from "@/lib/auth";
import { serverGet, ServerApiError } from "@/lib/server-api";
import { ChurchRecordingForm } from "@/components/church-recording-form";
import { LanguagePicker } from "@/components/i18n/language-picker";
import type { BranchSummary, FinanceAccountSummary, OfferingTypeSummary, ExpenseCategorySummary, ServiceTypeSummary, ServiceScheduleSummary } from "@/lib/types";

export default async function ChurchRecordingPage({ params }: { params: Promise<{ branchId: string; kind: string }> }) {
  const { branchId, kind } = await params;
  if (!/^[a-f\d]{24}$/i.test(branchId) || (kind !== "finance" && kind !== "attendance")) notFound();
  const user = await requireServerSession(`/record/${branchId}/${kind}`);
  const t = await getTranslations("recording");
  let context: { branch: Pick<BranchSummary, "_id" | "name" | "district" | "oversightRegion">; canRecordOfferings: boolean; canRecordExpenses: boolean };
  try { context = await serverGet(`/church-reporting/${branchId}`, { redirectOnForbidden: false }); }
  catch (error) {
    if (!(error instanceof ServerApiError) || ![403, 404].includes(error.status)) throw error;
    return <main className="mx-auto max-w-xl px-5 py-16"><p className="text-sm font-semibold">ChuFlow</p><h1 className="mt-8 text-2xl font-semibold">{t("restrictedTitle")}</h1><p className="mt-4 leading-7 text-[#6b6b6b]">{t("restrictedBody")}</p><Link className="mt-6 inline-block underline" href="/login?reason=switch-account">{t("switchAccount")}</Link></main>;
  }
  const [serviceTypes, schedules, accounts, offeringTypes, categories] = await Promise.all([
    serverGet<ServiceTypeSummary[]>(`/service-types?branchId=${branchId}`),
    serverGet<ServiceScheduleSummary[]>(`/service-schedules?branchId=${branchId}`),
    kind === "finance" ? serverGet<FinanceAccountSummary[]>("/finance/accounts") : [],
    kind === "finance" ? serverGet<OfferingTypeSummary[]>("/finance/offering-types") : [],
    kind === "finance" ? serverGet<ExpenseCategorySummary[]>("/finance/expense-categories") : [],
  ]);
  return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <Link href={kind === "finance" ? "/finance" : "/attendance"} className="text-sm text-[#6b6b6b]">← {t("back")}</Link>
    <header className="my-7"><div className="flex items-center justify-between gap-4"><p className="text-sm font-semibold">ChuFlow · {context.branch.name}</p><LanguagePicker /></div><h1 className="mt-3 text-3xl font-semibold tracking-tight">{t(kind === "finance" ? "financeTitle" : "attendanceTitle")}</h1><p className="mt-3 text-sm leading-6 text-[#6b6b6b]">{t("localHint")}</p></header>
    <ChurchRecordingForm branch={context.branch} kind={kind} accounts={accounts} offeringTypes={offeringTypes} categories={categories} serviceTypes={serviceTypes} schedules={schedules} canRecordOfferings={context.canRecordOfferings} canRecordExpenses={context.canRecordExpenses} userRole={user.role} />
  </main>;
}
