/* Finance response shapes, mirroring apps/web/src/lib/types.ts and apps/api/src/finance/dto. */

import type { Paginated } from '@/lib/types';

export type FinanceBranchRef = { _id?: string; name?: string; oversightRegion?: string; district?: string };
export type NamedRef = { _id?: string; name?: string; key?: string };
export type UserRef = { _id?: string; firstName?: string; lastName?: string; email?: string };

export type OfferingTypeSummary = { _id: string; name: string; key: string; description?: string; isActive: boolean; sortOrder?: number };
export type FinanceAccountSummary = { _id: string; name: string; key: string; description?: string; isActive: boolean; sortOrder?: number };
export type ExpenseCategorySummary = {
  _id: string;
  name: string;
  key: string;
  description?: string;
  defaultAccountKey?: string;
  isActive: boolean;
  sortOrder?: number;
};

export type EntryPermissions = { canEdit: boolean; reason: string };

export type OfferingEntrySummary = {
  _id: string;
  branchId?: FinanceBranchRef;
  serviceDate: string;
  serviceLabel?: string;
  serviceTypeId?: NamedRef;
  serviceTypeLabel: string;
  offeringTypeId?: NamedRef;
  offeringTypeLabel: string;
  accountId?: NamedRef;
  amount: number;
  currency: string;
  notes?: string;
  createdBy?: UserRef;
  updatedBy?: UserRef;
  createdAt?: string;
  updatedAt?: string;
  permissions?: EntryPermissions;
};

export type ExpenseEntrySummary = {
  _id: string;
  branchId?: FinanceBranchRef;
  expenseDate: string;
  accountId?: NamedRef;
  accountLabel: string;
  expenseCategoryId?: NamedRef;
  expenseCategoryLabel: string;
  serviceLabel?: string;
  payee?: string;
  description: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
  notes?: string;
  status: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdBy?: UserRef;
  createdAt?: string;
  permissions?: EntryPermissions;
};

export type FinanceLedgerEntrySummary = {
  _id: string;
  branchId?: FinanceBranchRef;
  entryDate: string;
  periodKey: string;
  accountId?: NamedRef;
  accountLabel: string;
  direction: string;
  sourceType: string;
  sourceId: string;
  serviceLabel?: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  createdAt?: string;
};

export type OfferingListResponse = Paginated<OfferingEntrySummary> & {
  summary: { totalAmount: number; currentMonthTotal: number; totalEntries: number; visibleBranchCount: number };
  byType: { offeringTypeId: string; label: string; totalAmount: number; entryCount: number }[];
};

export type ExpenseListResponse = Paginated<ExpenseEntrySummary> & {
  summary: { totalAmount: number; pendingAmount: number; pendingCount: number; visibleBranchCount: number };
};

export type FinanceLedgerResponse = Paginated<FinanceLedgerEntrySummary> & {
  summary: { totalCredits: number; totalDebits: number; netBalance: number; pendingExpenseApprovals: number; lockedPeriods: number };
  byAccount: { accountId: string; label: string; totalCredits: number; totalDebits: number; balance: number }[];
  byBranch: { branchId: string; name: string; totalCredits: number; totalDebits: number; balance: number }[];
};

/** Currencies offered on the phone; the API stores any ISO code and defaults to USD. */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'NGN', 'GHS', 'XOF', 'BRL'] as const;
