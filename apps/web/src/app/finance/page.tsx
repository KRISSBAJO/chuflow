import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Icon } from "@/components/app/icons";
import { ExpenseCategoryManagementCard } from "@/components/expense-category-management-card";
import { ExpenseEntriesTable } from "@/components/expense-entries-table";
import { FinanceAccountManagementCard } from "@/components/finance-account-management-card";
import { FinanceLedgerTable } from "@/components/finance-ledger-table";
import { FinanceLockManagementCard } from "@/components/finance-lock-management-card";
import { FinanceScopeFilterBar } from "@/components/finance-scope-filter-bar";
import { MetricCard } from "@/components/metric-card";
import { OfferingEntriesTable } from "@/components/offering-entries-table";
import { OfferingTypeManagementCard } from "@/components/offering-type-management-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
  Pagination,
  TabLinks,
} from "@/components/ui/ui";
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
  const t = await getTranslations("admin.finance");
  const format = await getFormatter();
  const formatMoney = (amount: number, currency = "USD") =>
    format.number(amount, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const params = await searchParams;
  const activeTab =
    params.tab === "offerings" ||
    params.tab === "expenses" ||
    params.tab === "setup"
      ? params.tab
      : "ledger";
  const canChooseBranch = canFilterAcrossBranches(user.role, user.hasOversight);
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
  const selectedBranchId = canChooseBranch
    ? params.branchId?.trim() || undefined
    : user.branchId;
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

  const [
    branches,
    oversightRegions,
    districts,
    offeringTypes,
    accounts,
    expenseCategories,
    serviceTypes,
    serviceSchedules,
    offeringList,
    expenseList,
    pendingExpenses,
    ledger,
    locks,
  ] = await Promise.all([
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
    serverGet<DistrictOption[]>("/districts").catch(() => []),
    serverGet<OfferingTypeSummary[]>("/finance/offering-types").catch(() => []),
    serverGet<FinanceAccountSummary[]>("/finance/accounts").catch(() => []),
    serverGet<ExpenseCategorySummary[]>("/finance/expense-categories").catch(
      () => [],
    ),
    serverGet<ServiceTypeSummary[]>("/service-types").catch(() => []),
    serverGet<ServiceScheduleSummary[]>("/service-schedules").catch(() => []),
    serverGet<OfferingListResponse>(
      `/finance/offerings?${offeringQuery.toString()}`,
    ).catch(() => ({
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
    serverGet<ExpenseListResponse>(
      `/finance/expenses?${expenseQuery.toString()}`,
    ).catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
      summary: {
        totalAmount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        visibleBranchCount: 0,
      },
    })),
    serverGet<ExpenseListResponse>(
      `/finance/expenses?${pendingExpenseQuery.toString()}`,
    ).catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
      summary: {
        totalAmount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        visibleBranchCount: 0,
      },
    })),
    serverGet<FinanceLedgerResponse>(
      `/finance/ledger?${ledgerQuery.toString()}`,
    ).catch(() => ({
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
    serverGet<FinanceLockSummary[]>(
      `/finance/locks?${locksQuery.toString()}`,
    ).catch(() => []),
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
    nextQuery.set(
      "offeringPage",
      overrides.offeringPage ?? String(offeringPage),
    );
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

  const pagerHrefs = (
    pageKey: "offeringPage" | "expensePage" | "ledgerPage",
    page: number,
    totalPages: number,
  ) => ({
    prevHref: buildPageHref(pageKey, Math.max(page - 1, 1)),
    nextHref: buildPageHref(pageKey, Math.min(page + 1, totalPages)),
  });

  const tabs = [
    {
      id: "ledger",
      label: t("tabs.ledger"),
      count: ledger.pagination.total,
    },
    {
      id: "offerings",
      label: t("tabs.offerings"),
      count: offeringList.pagination.total,
    },
    {
      id: "expenses",
      label: t("tabs.expenses"),
      count: expenseList.pagination.total,
    },
    ...(canManageTypes || canManageLocks
      ? [
          {
            id: "setup",
            label: t("tabs.setup"),
            count:
              accounts.length +
              expenseCategories.length +
              offeringTypes.length +
              locks.length,
          },
        ]
      : []),
  ];

  const showExpenseSide = canApproveExpenses;

  const createdId =
    params.created && /^[a-f0-9]{24}$/i.test(params.created)
      ? params.created
      : undefined;
  const savedOffering =
    createdId && activeTab === "offerings"
      ? await serverGet<OfferingListResponse["items"][number]>(
          `/finance/offerings/${createdId}`,
        ).catch(() => undefined)
      : undefined;
  const savedExpense =
    createdId && activeTab === "expenses"
      ? await serverGet<ExpenseListResponse["items"][number]>(
          `/finance/expenses/${createdId}`,
        ).catch(() => undefined)
      : undefined;
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          canCreateOfferings || canCreateExpenses ? (
            <Link href="/finance/new" className={buttonClass("primary", "md")}>
              <Icon name="plus" className="h-4 w-4" />
              {t("newEntry")}
            </Link>
          ) : (
            <a href="#ledger" className={buttonClass("secondary", "md")}>
              {t("reviewLedger")}
            </a>
          )
        }
      />

      {savedOffering && (
        <Card className="p-6">
          <CardHeader
            label={t("justCreated")}
            title={t("savedOfferingTitle")}
            description={t("savedOfferingDescription")}
          />
          <OfferingEntriesTable
            entries={[savedOffering]}
            offeringTypes={offeringTypes}
            serviceTypes={serviceTypes}
            accounts={accounts}
          />
        </Card>
      )}
      {savedExpense && (
        <Card className="p-6">
          <CardHeader
            label={t("justCreated")}
            title={t("savedExpenseTitle")}
            description={t("savedExpenseDescription")}
          />
          <ExpenseEntriesTable
            entries={[savedExpense]}
            accounts={accounts}
            expenseCategories={expenseCategories}
            serviceSchedules={serviceSchedules}
            canApprove={canApproveExpenses}
          />
        </Card>
      )}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label={t("metrics.totalCredits")}
          value={formatMoney(ledger.summary.totalCredits)}
          delta={t("metrics.totalCreditsDelta")}
          tone="cool"
        />
        <MetricCard
          label={t("metrics.totalDebits")}
          value={formatMoney(ledger.summary.totalDebits)}
          delta={t("metrics.totalDebitsDelta")}
          tone="warm"
        />
        <MetricCard
          label={t("metrics.netBalance")}
          value={formatMoney(ledger.summary.netBalance)}
          delta={t("metrics.netBalanceDelta")}
          tone="cool"
        />
        <MetricCard
          label={t("metrics.pendingExpenses")}
          value={ledger.summary.pendingExpenseApprovals}
          delta={t("metrics.pendingExpensesDelta", { amount: formatMoney(expenseList.summary.pendingAmount) })}
          tone="warm"
        />
        <MetricCard
          label={t("metrics.lockedPeriods")}
          value={ledger.summary.lockedPeriods}
          delta={t("metrics.lockedPeriodsDelta")}
          tone="warm"
        />
      </section>

      <TabLinks
        className="self-start"
        items={tabs.map((tab) => ({
          href: buildFinanceHref({ tab: tab.id }),
          label: tab.label,
          count: tab.count,
          active: activeTab === tab.id,
        }))}
      />

      {activeTab === "ledger" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div id="ledger" className="min-w-0">
            <FinanceLedgerTable
              ledger={ledger}
              previousHref={buildPageHref(
                "ledgerPage",
                Math.max(ledger.pagination.page - 1, 1),
              )}
              nextHref={buildPageHref(
                "ledgerPage",
                Math.min(
                  ledger.pagination.page + 1,
                  ledger.pagination.totalPages,
                ),
              )}
            />
          </div>

          <Card
            className="app-rise p-6 sm:p-7"
            style={{ animationDelay: "60ms" }}
          >
            <CardHeader
              label={t("branchBalance.label")}
              title={t("branchBalance.title")}
              description={t("branchBalance.description")}
            />
            <div className="mt-6">
              {ledger.byBranch.length > 0 ? (
                <ul className="divide-y divide-black/[0.05]">
                  {ledger.byBranch.slice(0, 8).map((item) => (
                    <li
                      key={item.branchId}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[#111111]">
                          {item.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                          {item.district} · {item.oversightRegion}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[14px] font-semibold tabular-nums ${
                          item.balance < 0 ? "text-red-700" : "text-[#111111]"
                        }`}
                      >
                        {formatMoney(item.balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon="branches" title={t("branchBalance.emptyTitle")}>
                  {t("branchBalance.emptyBody")}
                </EmptyState>
              )}
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "offerings" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card
            className="app-rise p-6 sm:p-7 xl:col-span-2"
            style={{ animationDelay: "60ms" }}
          >
            <CardHeader
              label={t("offerings.label")}
              title={t("offerings.title")}
              description={t("offerings.description")}
              action={<Badge>{t("entries", { count: offeringList.pagination.total })}</Badge>}
            />

            <div className="mt-6">
              <OfferingEntriesTable
                entries={offeringList.items}
                offeringTypes={offeringTypes}
                serviceTypes={serviceTypes}
                accounts={accounts}
              />
            </div>

            <div className="mt-5">
              <Pagination
                page={offeringList.pagination.page}
                totalPages={offeringList.pagination.totalPages}
                {...pagerHrefs(
                  "offeringPage",
                  offeringList.pagination.page,
                  offeringList.pagination.totalPages,
                )}
              />
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {showExpenseSide ? (
            <div id="finance-entry" className="min-w-0 space-y-4">
              {canApproveExpenses ? (
                <Card
                  className="app-rise p-6 sm:p-7"
                  style={{ animationDelay: "60ms" }}
                >
                  <CardHeader
                    label={t("expenseApprovals.label")}
                    title={t("expenseApprovals.title")}
                    description={t("expenseApprovals.description")}
                    action={
                      <Badge
                        tone={
                          pendingExpenses.summary.pendingCount
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {t("pendingCount", { count: pendingExpenses.summary.pendingCount })}
                      </Badge>
                    }
                  />

                  <div className="mt-6">
                    <ExpenseEntriesTable
                      entries={pendingExpenses.items}
                      accounts={accounts}
                      expenseCategories={expenseCategories}
                      serviceSchedules={serviceSchedules}
                      canApprove={canApproveExpenses}
                    />
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Card
            className={`app-rise p-6 sm:p-7 ${showExpenseSide ? "" : "xl:col-span-2"}`}
            style={{ animationDelay: "120ms" }}
          >
            <CardHeader
              label={t("expenseRecords.label")}
              title={t("expenseRecords.title")}
              description={t("expenseRecords.description")}
              action={<Badge>{t("entries", { count: expenseList.pagination.total })}</Badge>}
            />

            <div className="mt-6">
              <ExpenseEntriesTable
                entries={expenseList.items}
                accounts={accounts}
                expenseCategories={expenseCategories}
                serviceSchedules={serviceSchedules}
                canApprove={false}
              />
            </div>

            <div className="mt-5">
              <Pagination
                page={expenseList.pagination.page}
                totalPages={expenseList.pagination.totalPages}
                {...pagerHrefs(
                  "expensePage",
                  expenseList.pagination.page,
                  expenseList.pagination.totalPages,
                )}
              />
            </div>
          </Card>
        </section>
      ) : null}

      {activeTab === "setup" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {canManageLocks ? (
            <div className="min-w-0 space-y-4">
              <FinanceLockManagementCard
                locks={locks}
                branches={branches}
                defaultBranchId={selectedBranchId || user.branchId}
                canChooseBranch={canChooseBranch}
              />
            </div>
          ) : null}

          <div
            className={`min-w-0 space-y-4 ${canManageLocks ? "" : "xl:col-span-2"}`}
          >
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
              <Card className="p-6 sm:p-7">
                <EmptyState icon="settings" title={t("limitedAccessTitle")}>
                  {t("limitedAccessBody")}
                </EmptyState>
              </Card>
            )}
          </div>
        </section>
      ) : null}
    </Shell>
  );
}
