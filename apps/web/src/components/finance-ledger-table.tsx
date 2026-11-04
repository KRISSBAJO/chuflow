import { Badge, Card, CardHeader, EmptyState, formatStatus, Pagination, statusTone, TableWrap } from "@/components/ui/ui";
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
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="Ledger"
        title="Credits, debits and balance"
        description="Every approved offering and expense rolls into one branch-aware statement."
        action={
          <Badge>
            <span className="tabular-nums">
              {startItem}–{endItem} of {ledger.pagination.total}
            </span>
          </Badge>
        }
      />

      {ledger.byAccount.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {ledger.byAccount.slice(0, 3).map((account) => (
            <div key={account.accountId} className="rounded-2xl bg-[#f6f5f1] p-4">
              <p className="truncate text-[13px] font-medium text-[#6b6b6b]">{account.label}</p>
              <p
                className={`lp-heading mt-1.5 text-[22px] leading-none tabular-nums ${
                  account.balance < 0 ? "text-red-700" : ""
                }`}
              >
                {formatMoney(account.balance)}
              </p>
              <p className="mt-2 text-[12px] leading-[1.5] text-[#8a8780]">
                <span className="tabular-nums text-emerald-700">{formatMoney(account.totalCredits)}</span> in ·{" "}
                <span className="tabular-nums text-red-700">{formatMoney(account.totalDebits)}</span> out
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {ledger.items.length > 0 ? (
          <TableWrap>
            <table className="ui-table min-w-[960px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Account</th>
                  <th>Direction</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Service</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((entry) => (
                  <tr key={entry._id}>
                    <td className="whitespace-nowrap tabular-nums text-[#55534e]">
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </td>
                    <td className="text-[#55534e]">{entry.branchId?.name || "Branch"}</td>
                    <td className="text-[#55534e]">{entry.accountLabel}</td>
                    <td>
                      <Badge tone={entry.direction === "credit" ? "success" : "danger"}>
                        {formatStatus(entry.direction)}
                      </Badge>
                    </td>
                    <td className="text-[#55534e]">{formatStatus(entry.sourceType)}</td>
                    <td className="font-medium">{entry.description}</td>
                    <td className="text-[#6b6b6b]">{entry.serviceLabel || "—"}</td>
                    <td
                      className={`whitespace-nowrap text-right font-semibold tabular-nums ${
                        entry.direction === "credit" ? "text-emerald-700" : "text-[#111111]"
                      }`}
                    >
                      {entry.direction === "credit" ? "+" : "−"}
                      {formatMoney(entry.amount, entry.currency)}
                    </td>
                    <td>
                      <Badge tone={statusTone(entry.status)} dot>
                        {formatStatus(entry.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState icon="finance" title="No ledger activity">
            No ledger activity has been recorded in the selected scope yet.
          </EmptyState>
        )}
      </div>

      <div className="mt-5">
        <Pagination
          page={ledger.pagination.page}
          totalPages={ledger.pagination.totalPages}
          prevHref={previousHref}
          nextHref={nextHref}
        />
      </div>
    </Card>
  );
}
