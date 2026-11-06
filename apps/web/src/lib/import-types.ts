import type { ImportKind } from "./import-fields";
export type ImportView = {
  job: {
    _id: string;
    branchId: string;
    kind: ImportKind;
    status: string;
    expectedRows: number;
    valid: number;
    duplicates: number;
    invalid: number;
    expiresAt: string;
  };
  counts: Record<string, number>;
  rows: {
    _id: string;
    sourceRow: number;
    status: string;
    reason: string;
    values: Record<string, string>;
    normalized?: Record<string, unknown>;
  }[];
  pagination: { page: number; total: number; totalPages: number };
};
export type ImportHistory = {
  _id: string;
  kind: ImportKind;
  branchId: string;
  status: string;
  expectedRows: number;
  valid: number;
  invalid: number;
  duplicates: number;
  createdAt?: string;
};
