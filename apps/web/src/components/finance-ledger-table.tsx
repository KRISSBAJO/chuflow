import Link from "next/link";
import type { FinanceLedgerResponse } from "@/lib/types";

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function FinanceLedgerTable({
  ledger,
  previousHref,
  nextHref,
}: {
  ledger: FinanceLedgerResponse;
  previousHref: string;
  nextHref: string;
}) {
  const startItem =
    ledger.pagination.total === 0
      ? 0
      : (ledger.pagination.page - 1) * ledger.pagination.pageSize + 1;
  const endItem = Math.min(
    ledger.pagination.page * ledger.pagination.pageSize,
    ledger.pagination.total,
  );

  return (
    <section className="surface rounded-[24px] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Ledger</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Credits, debits, and branch balance
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Every approved offering and expense rolls into one branch-aware statement.
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Showing {startItem}-{endItem} of {ledger.pagination.total}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {ledger.byAccount.length > 0 ? (
          ledger.byAccount.slice(0, 3).map((account) => (
            <div
              key={account.accountId}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <p className="text-sm font-semibold text-slate-900">{account.label}</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">
                {formatMoney(account.balance)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {formatMoney(account.totalCredits)} credits · {formatMoney(account.totalDebits)} debits
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500 lg:col-span-3">
            No ledger activity has been recorded in the selected scope yet.
          </div>
        )}
      </div>

      {ledger.items.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Date",
                  "Branch",
                  "Account",
                  "Direction",
                  "Source",
                  "Description",
                  "Service",
                  "Amount",
                  "Status",
                ].map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.items.map((entry) => (
                <tr key={entry._id} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(entry.entryDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {entry.branchId?.name || "Branch"}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{entry.accountLabel}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        entry.direction === "credit"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {entry.direction}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{entry.sourceType}</td>
                  <td className="px-4 py-4 text-slate-900">{entry.description}</td>
                  <td className="px-4 py-4 text-slate-600">{entry.serviceLabel || "—"}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    {formatMoney(entry.amount, entry.currency)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-2 text-sm">
        <Link
          href={previousHref}
          aria-disabled={ledger.pagination.page <= 1}
          className={`rounded-xl border px-4 py-2 ${
            ledger.pagination.page <= 1
              ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Previous
        </Link>
        <span className="text-slate-500">
          Page {ledger.pagination.page} of {ledger.pagination.totalPages}
        </span>
        <Link
          href={nextHref}
          aria-disabled={ledger.pagination.page >= ledger.pagination.totalPages}
          className={`rounded-xl border px-4 py-2 ${
            ledger.pagination.page >= ledger.pagination.totalPages
              ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Next
        </Link>
      </div>
    </section>
  );
}
