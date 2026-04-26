import Link from "next/link";
import { ExpenseCategoryManagementCard } from "@/components/expense-category-management-card";
import { ExpenseEntriesTable } from "@/components/expense-entries-table";
import { ExpenseEntryForm } from "@/components/expense-entry-form";
import { FinanceAccountManagementCard } from "@/components/finance-account-management-card";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import { FinanceLockManagementCard } from "@/components/finance-lock-management-card";
import { FinanceScopeFilterBar } from "@/components/finance-scope-filter-bar";
import { MetricCard } from "@/components/metric-card";
import { OfferingEntriesTable } from "@/components/offering-entries-table";
import { OfferingEntryForm } from "@/components/offering-entry-form";
import { OfferingTypeManagementCard } from "@/components/offering-type-management-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import {
  canApproveExpenseEntries,
  canCreateExpenseEntries,
  canCreateFinanceEntries,
  canFilterAcrossBranches,
  canManageFinanceLocks,
  canManageFinanceSettings,
  isGlobalRole,
  isNationalRole,
} from "@/lib/permissions";
import type {
  BranchSummary,
  DistrictOption,
  ExpenseCategorySummary,
  ExpenseListResponse,
  FinanceAccountSummary,
  FinanceLedgerResponse,
  FinanceLockSummary,
  OfferingListResponse,
  OfferingTypeSummary,
  OversightRegionOption,
  ServiceScheduleSummary,
  ServiceTypeSummary,
} from "@/lib/types";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function appendScopeParams(
  query: URLSearchParams,
  filters: {
    oversightRegion?: string;
    district?: string;
    branchId?: string;
    offeringTypeId?: string;
    accountId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query.set(key, value);
    }
  }
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireServerRole("/finance");
  const params = await searchParams;
  const activeTab =
    params.tab === "offerings" ||
    params.tab === "expenses" ||
    params.tab === "setup"
      ? params.tab
      : "ledger";
  const canChooseBranch = canFilterAcrossBranches(user.role);
  const canCreateOfferings = canCreateFinanceEntries(user.role);
  const canCreateExpenses = canCreateExpenseEntries(user.role);
  const canApproveExpenses = canApproveExpenseEntries(user.role);
  const canManageTypes = canManageFinanceSettings(user.role);
  const canManageLocks = canManageFinanceLocks(user.role);
  const requestedOversightRegion = isGlobalRole(user.role)
    ? params.oversightRegion?.trim() || undefined
    : user.oversightRegion;
  const requestedDistrict =
    isGlobalRole(user.role) || isNationalRole(user.role)
      ? params.district?.trim() || undefined
      : user.district;
  const selectedBranchId = canChooseBranch ? params.branchId?.trim() || undefined : user.branchId;
  const offeringTypeId = params.offeringTypeId?.trim() || undefined;
  const accountId = params.accountId?.trim() || undefined;
  const search = params.search?.trim() || undefined;
  const dateFrom = params.dateFrom?.trim() || undefined;
  const dateTo = params.dateTo?.trim() || undefined;
  const offeringPage = Math.max(Number(params.offeringPage) || 1, 1);
  const expensePage = Math.max(Number(params.expensePage) || 1, 1);
  const ledgerPage = Math.max(Number(params.ledgerPage) || 1, 1);

  const offeringQuery = new URLSearchParams();
  appendScopeParams(offeringQuery, {
    oversightRegion: requestedOversightRegion,
    district: requestedDistrict,
    branchId: selectedBranchId,
    offeringTypeId,
    accountId,
    search,
    dateFrom,
    dateTo,
  });
  offeringQuery.set("page", String(offeringPage));
  offeringQuery.set("limit", "10");

  const expenseQuery = new URLSearchParams();
  appendScopeParams(expenseQuery, {
    oversightRegion: requestedOversightRegion,
    district: requestedDistrict,
    branchId: selectedBranchId,
    accountId,
    search,
    dateFrom,
    dateTo,
  });
  expenseQuery.set("page", String(expensePage));
  expenseQuery.set("limit", "10");

  const pendingExpenseQuery = new URLSearchParams(expenseQuery);
  pendingExpenseQuery.set("status", "submitted");
  pendingExpenseQuery.set("page", "1");
  pendingExpenseQuery.set("limit", "6");

  const ledgerQuery = new URLSearchParams();
  appendScopeParams(ledgerQuery, {
    oversightRegion: requestedOversightRegion,
    district: requestedDistrict,
    branchId: selectedBranchId,
    accountId,
    search,
    dateFrom,
    dateTo,
  });
  ledgerQuery.set("page", String(ledgerPage));
  ledgerQuery.set("limit", "12");

  const locksQuery = new URLSearchParams();
  appendScopeParams(locksQuery, {
    oversightRegion: requestedOversightRegion,
    district: requestedDistrict,
    branchId: selectedBranchId,
  });

  const [branches, oversightRegions, districts, offeringTypes, accounts, expenseCategories, serviceTypes, serviceSchedules, offeringList, expenseList, pendingExpenses, ledger, locks] =
    await Promise.all([
      serverGet<BranchSummary[]>("/branches").catch(() => []),
      serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
      serverGet<DistrictOption[]>("/districts").catch(() => []),
      serverGet<OfferingTypeSummary[]>("/finance/offering-types").catch(() => []),
      serverGet<FinanceAccountSummary[]>("/finance/accounts").catch(() => []),
      serverGet<ExpenseCategorySummary[]>("/finance/expense-categories").catch(() => []),
      serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
      serverGet<ServiceScheduleSummary[]>("/service-schedules").catch(() => []),
      serverGet<OfferingListResponse>(`/finance/offerings?${offeringQuery.toString()}`).catch(() => ({
        items: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
        summary: {
          totalAmount: 0,
          currentMonthTotal: 0,
          totalEntries: 0,
          visibleBranchCount: 0,
        },
        byType: [],
        byBranch: [],
      })),
      serverGet<ExpenseListResponse>(`/finance/expenses?${expenseQuery.toString()}`).catch(() => ({
        items: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
        summary: {
          totalAmount: 0,
          pendingAmount: 0,
          pendingCount: 0,
          visibleBranchCount: 0,
        },
      })),
      serverGet<ExpenseListResponse>(`/finance/expenses?${pendingExpenseQuery.toString()}`).catch(
        () => ({
          items: [],
          pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
          summary: {
            totalAmount: 0,
            pendingAmount: 0,
            pendingCount: 0,
            visibleBranchCount: 0,
          },
        }),
      ),
      serverGet<FinanceLedgerResponse>(`/finance/ledger?${ledgerQuery.toString()}`).catch(() => ({
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
        summary: {
          totalCredits: 0,
          totalDebits: 0,
          netBalance: 0,
          pendingExpenseApprovals: 0,
          lockedPeriods: 0,
        },
        byAccount: [],
        byBranch: [],
      })),
      serverGet<FinanceLockSummary[]>(`/finance/locks?${locksQuery.toString()}`).catch(() => []),
    ]);

  function buildFinanceHref(overrides: {
    tab?: string;
    offeringPage?: string;
    expensePage?: string;
    ledgerPage?: string;
  }) {
    const nextQuery = new URLSearchParams();
    appendScopeParams(nextQuery, {
      oversightRegion: requestedOversightRegion,
      district: requestedDistrict,
      branchId: selectedBranchId,
      offeringTypeId,
      accountId,
      search,
      dateFrom,
      dateTo,
    });
    nextQuery.set("tab", overrides.tab ?? activeTab);
    nextQuery.set("offeringPage", overrides.offeringPage ?? String(offeringPage));
    nextQuery.set("expensePage", overrides.expensePage ?? String(expensePage));
    nextQuery.set("ledgerPage", overrides.ledgerPage ?? String(ledgerPage));
    return `/finance?${nextQuery.toString()}`;
  }

  function buildPageHref(
    pageKey: "offeringPage" | "expensePage" | "ledgerPage",
    nextPage: number,
  ) {
    return buildFinanceHref({
      offeringPage:
        pageKey === "offeringPage" ? String(nextPage) : String(offeringPage),
      expensePage:
        pageKey === "expensePage" ? String(nextPage) : String(expensePage),
      ledgerPage:
        pageKey === "ledgerPage" ? String(nextPage) : String(ledgerPage),
    });
  }

  const tabs = [
    {
      id: "ledger",
      label: "Ledger",
      count: ledger.pagination.total,
    },
    {
      id: "offerings",
      label: "Offerings",
      count: offeringList.pagination.total,
    },
    {
      id: "expenses",
      label: "Expenses",
      count: expenseList.pagination.total,
    },
    ...(canManageTypes || canManageLocks
      ? [
          {
            id: "setup",
            label: "Finance setup",
            count:
              accounts.length +
              expenseCategories.length +
              offeringTypes.length +
              locks.length,
          },
        ]
      : []),
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Finance"
        title="Ledger, expenses, approvals, and branch balance control"
        description="Run branch offerings and expenses through one scoped finance ledger with approvals, account routing, month-end locks, and oversight visibility."
        action={
          canCreateOfferings || canCreateExpenses ? (
            <a
              href="#finance-entry"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Open finance entry
            </a>
          ) : (
            <a
              href="#ledger"
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Review ledger
            </a>
          )
        }
      />

      <FinanceScopeFilterBar
        canChooseRegion={isGlobalRole(user.role)}
        canChooseDistrict={isGlobalRole(user.role) || isNationalRole(user.role)}
        canChooseBranch={canChooseBranch}
        oversightRegion={requestedOversightRegion}
        district={requestedDistrict}
        branchId={selectedBranchId}
        offeringTypeId={offeringTypeId}
        accountId={accountId}
        search={search}
        dateFrom={dateFrom}
        dateTo={dateTo}
        oversightRegions={oversightRegions}
        districts={districts}
        branches={branches}
        offeringTypes={offeringTypes}
        accounts={accounts}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Total credits"
          value={formatMoney(ledger.summary.totalCredits)}
          delta="Approved giving in this scope"
          tone="cool"
        />
        <MetricCard
          label="Total debits"
          value={formatMoney(ledger.summary.totalDebits)}
          delta="Expense load in this scope"
          tone="warm"
        />
        <MetricCard
          label="Net balance"
          value={formatMoney(ledger.summary.netBalance)}
          delta="Credits less debits"
          tone="cool"
        />
        <MetricCard
          label="Pending expenses"
          value={ledger.summary.pendingExpenseApprovals}
          delta={`${formatMoney(expenseList.summary.pendingAmount)} awaiting approval`}
          tone="warm"
        />
        <MetricCard
          label="Locked periods"
          value={ledger.summary.lockedPeriods}
          delta="Month-end finance locks in scope"
          tone="warm"
        />
      </section>

      <section className="surface rounded-[24px] p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                href={buildFinanceHref({ tab: tab.id })}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {activeTab === "ledger" ? (
        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            <div id="ledger">
              <FinanceLedgerTable
                ledger={ledger}
                previousHref={buildPageHref(
                  "ledgerPage",
                  Math.max(ledger.pagination.page - 1, 1),
                )}
                nextHref={buildPageHref(
                  "ledgerPage",
                  Math.min(ledger.pagination.page + 1, ledger.pagination.totalPages),
                )}
              />
            </div>
          </div>

          <div className="space-y-5">
            <section className="surface rounded-[24px] p-5">
              <div className="flex flex-col gap-2">
                <p className="eyebrow">Branch balance</p>
                <h3 className="text-lg font-semibold text-slate-950">
                  Where balance pressure sits
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                {ledger.byBranch.length > 0 ? (
                  ledger.byBranch.slice(0, 8).map((item) => (
                    <div
                      key={item.branchId}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.district} · {item.oversightRegion}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatMoney(item.balance)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                    No branch balance data exists in this scope yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      ) : null}

      {activeTab === "offerings" ? (
        <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-5" id="finance-entry">
            {canCreateOfferings ? (
              <section className="surface rounded-[24px] p-1.5">
                <OfferingEntryForm
                  defaultBranchId={user.branchId}
                  branches={branches}
                  offeringTypes={offeringTypes}
                  serviceTypes={serviceTypes}
                  serviceSchedules={serviceSchedules}
                  accounts={accounts}
                />
              </section>
            ) : null}
          </div>

          <section className="surface rounded-[24px] p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Offering records</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Branch offering intake
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review giving by service, offering type, and finance account.
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {offeringList.pagination.total} offering entries
              </div>
            </div>

            <div className="mt-5">
              <OfferingEntriesTable
                entries={offeringList.items}
                offeringTypes={offeringTypes}
                serviceTypes={serviceTypes}
                accounts={accounts}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 text-sm">
              <Link
                href={buildPageHref(
                  "offeringPage",
                  Math.max(offeringList.pagination.page - 1, 1),
                )}
                aria-disabled={offeringList.pagination.page <= 1}
                className={`rounded-xl border px-4 py-2 ${
                  offeringList.pagination.page <= 1
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Previous
              </Link>
              <span className="text-slate-500">
                Page {offeringList.pagination.page} of {offeringList.pagination.totalPages}
              </span>
              <Link
                href={buildPageHref(
                  "offeringPage",
                  Math.min(
                    offeringList.pagination.page + 1,
                    offeringList.pagination.totalPages,
                  ),
                )}
                aria-disabled={offeringList.pagination.page >= offeringList.pagination.totalPages}
                className={`rounded-xl border px-4 py-2 ${
                  offeringList.pagination.page >= offeringList.pagination.totalPages
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Next
              </Link>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-5" id="finance-entry">
            {canCreateExpenses ? (
              <section className="surface rounded-[24px] p-1.5">
                <ExpenseEntryForm
                  defaultBranchId={selectedBranchId || user.branchId}
                  branches={branches}
                  accounts={accounts}
                  expenseCategories={expenseCategories}
                  serviceSchedules={serviceSchedules}
                  canChooseBranch={canChooseBranch}
                />
              </section>
            ) : null}

            {canApproveExpenses ? (
              <section className="surface rounded-[24px] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="eyebrow">Expense approvals</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      Pending branch finance requests
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Review submitted expenses before they become approved debits.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {pendingExpenses.summary.pendingCount} pending
                  </div>
                </div>

                <div className="mt-5">
                  <ExpenseEntriesTable
                    entries={pendingExpenses.items}
                    accounts={accounts}
                    expenseCategories={expenseCategories}
                    serviceSchedules={serviceSchedules}
                    canApprove={canApproveExpenses}
                  />
                </div>
              </section>
            ) : null}
          </div>

          <section className="surface rounded-[24px] p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Expense records</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Reviewed and submitted expenses
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Track spending, category routing, and approved finance history.
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {expenseList.pagination.total} expense entries
              </div>
            </div>

            <div className="mt-5">
              <ExpenseEntriesTable
                entries={expenseList.items}
                accounts={accounts}
                expenseCategories={expenseCategories}
                serviceSchedules={serviceSchedules}
                canApprove={false}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 text-sm">
              <Link
                href={buildPageHref(
                  "expensePage",
                  Math.max(expenseList.pagination.page - 1, 1),
                )}
                aria-disabled={expenseList.pagination.page <= 1}
                className={`rounded-xl border px-4 py-2 ${
                  expenseList.pagination.page <= 1
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Previous
              </Link>
              <span className="text-slate-500">
                Page {expenseList.pagination.page} of {expenseList.pagination.totalPages}
              </span>
              <Link
                href={buildPageHref(
                  "expensePage",
                  Math.min(expenseList.pagination.page + 1, expenseList.pagination.totalPages),
                )}
                aria-disabled={expenseList.pagination.page >= expenseList.pagination.totalPages}
                className={`rounded-xl border px-4 py-2 ${
                  expenseList.pagination.page >= expenseList.pagination.totalPages
                    ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Next
              </Link>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "setup" ? (
        <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-5">
            {canManageLocks ? (
              <FinanceLockManagementCard
                locks={locks}
                branches={branches}
                defaultBranchId={selectedBranchId || user.branchId}
                canChooseBranch={canChooseBranch}
              />
            ) : null}
          </div>

          <div className="space-y-5">
            {canManageTypes ? (
              <>
                <FinanceAccountManagementCard accounts={accounts} />
                <ExpenseCategoryManagementCard
                  categories={expenseCategories}
                  accounts={accounts}
                />
                <OfferingTypeManagementCard offeringTypes={offeringTypes} />
              </>
            ) : (
              <section className="surface rounded-[24px] p-5">
                <p className="text-sm text-slate-500">
                  Finance setup is limited to the roles that manage shared accounts,
                  categories, offering types, and period locks.
                </p>
              </section>
            )}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}
