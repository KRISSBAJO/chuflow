"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AttendanceCreateForm } from "./attendance-create-form";
import { OfferingEntryForm } from "./offering-entry-form";
import { ExpenseEntryForm } from "./expense-entry-form";
import { Button, Card } from "./ui/ui";
import { ServiceTypeCreateForm } from "./service-type-create-form";
import type { BranchSummary, FinanceAccountSummary, OfferingTypeSummary, ExpenseCategorySummary, ServiceTypeSummary, ServiceScheduleSummary } from "@/lib/types";

export function ChurchRecordingForm({ branch, kind, accounts, offeringTypes, categories, serviceTypes, schedules, canRecordOfferings, canRecordExpenses, userRole }: {
  branch: Pick<BranchSummary, "_id" | "name">;
  kind: "finance" | "attendance";
  accounts: FinanceAccountSummary[];
  offeringTypes: OfferingTypeSummary[];
  categories: ExpenseCategorySummary[];
  serviceTypes: ServiceTypeSummary[];
  schedules: ServiceScheduleSummary[];
  canRecordOfferings: boolean;
  canRecordExpenses: boolean;
  userRole: string;
}) {
  const t = useTranslations("recording");
  const ts = useTranslations("org.serviceTypes");
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(canRecordOfferings ? "offerings" : "expenses");
  const basePath = `/church-reporting/${branch._id}`;
  const serviceSetup = <details className="mb-5 rounded-2xl border border-black/[0.06] bg-white p-5"><summary className="cursor-pointer text-sm font-medium">{ts("heading")}</summary><div className="mt-5"><ServiceTypeCreateForm branches={[branch]} defaultBranchId={branch._id} currentUserRole={userRole} /></div></details>;
  if (saved) return <Card className="p-6" role="status"><h2 className="text-xl font-semibold">{t("savedTitle")}</h2><p className="my-4 text-sm text-[#6b6b6b]">{t("savedBody", { church: branch.name })}</p><Button onClick={() => setSaved(false)}>{t("recordAnother")}</Button></Card>;
  if (kind === "attendance") return <>{serviceSetup}<Card className="p-5 sm:p-7"><AttendanceCreateForm branches={[branch]} defaultBranchId={branch._id} serviceTypes={serviceTypes} serviceSchedules={schedules} lockBranch submitPath={`${basePath}/attendance`} onSuccess={() => setSaved(true)} /></Card></>;
  return <div>
    {serviceSetup}
    {canRecordOfferings && canRecordExpenses && <div className="mb-4 flex gap-2" role="group" aria-label={t("entryType")}>
      <Button variant={mode === "offerings" ? "primary" : "secondary"} aria-pressed={mode === "offerings"} onClick={() => setMode("offerings")}>{t("offerings")}</Button>
      <Button variant={mode === "expenses" ? "primary" : "secondary"} aria-pressed={mode === "expenses"} onClick={() => setMode("expenses")}>{t("expenses")}</Button>
    </div>}
    {mode === "offerings" && canRecordOfferings ? <OfferingEntryForm branches={[branch]} defaultBranchId={branch._id} accounts={accounts} offeringTypes={offeringTypes} serviceTypes={serviceTypes} serviceSchedules={schedules} submitPath={`${basePath}/offerings`} onSuccess={() => setSaved(true)} /> : canRecordExpenses ? <ExpenseEntryForm branches={[branch]} defaultBranchId={branch._id} accounts={accounts} expenseCategories={categories} serviceSchedules={schedules} canChooseBranch={false} submitPath={`${basePath}/expenses`} onSuccess={() => setSaved(true)} /> : null}
  </div>;
}
