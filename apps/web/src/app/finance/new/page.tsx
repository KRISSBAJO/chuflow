import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { OfferingEntryForm } from "@/components/offering-entry-form";
import { ExpenseEntryForm } from "@/components/expense-entry-form";
import { canCreateFinanceEntries, canCreateExpenseEntries, canFilterAcrossBranches } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { BranchSummary, FinanceAccountSummary, OfferingTypeSummary, ExpenseCategorySummary, ServiceTypeSummary, ServiceScheduleSummary } from "@/lib/types";

export default async function NewPage() {
 const user = await requireServerRole("/finance");
 const t = await getTranslations("admin.finance");
 if (!canCreateFinanceEntries(user.role) && !canCreateExpenseEntries(user.role)) redirect("/unauthorized");
 const [branches, accounts, offeringTypes, categories, serviceTypes, schedules] = await Promise.all([
 serverGet<BranchSummary[]>("/branches"), serverGet<FinanceAccountSummary[]>("/finance/accounts"), serverGet<OfferingTypeSummary[]>("/finance/offering-types"), serverGet<ExpenseCategorySummary[]>("/finance/expense-categories"), serverGet<ServiceTypeSummary[]>("/service-types"), serverGet<ServiceScheduleSummary[]>("/service-schedules")]);
 return <CreatePage title={t("newEntry")} backHref="/finance">{canCreateFinanceEntries(user.role) ? <OfferingEntryForm branches={branches} defaultBranchId={user.branchId} accounts={accounts} offeringTypes={offeringTypes} serviceTypes={serviceTypes} serviceSchedules={schedules} /> : null}
{canCreateExpenseEntries(user.role) ? <ExpenseEntryForm branches={branches} defaultBranchId={user.branchId} accounts={accounts} expenseCategories={categories} serviceSchedules={schedules} canChooseBranch={canFilterAcrossBranches(user.role, user.hasOversight)} /> : null}</CreatePage>;
}
