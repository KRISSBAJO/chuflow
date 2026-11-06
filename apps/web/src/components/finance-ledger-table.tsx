import { useFormatter, useTranslations } from "next-intl";
import { Badge, Card, CardHeader, EmptyState, Pagination, statusTone, TableWrap } from "@/components/ui/ui";
import { useAppFormat, useStatusLabel } from "@/i18n/labels";
import type { FinanceLedgerResponse } from "@/lib/types";

export function FinanceLedgerTable({
  ledger,
  previousHref,
  nextHref,
}: {
  ledger: FinanceLedgerResponse;
  previousHref: string;
  nextHref: string;
}) {
  const t = useTranslations("admin.ledger");
  const format = useFormatter();
  const { date } = useAppFormat();
  const statusLabel = useStatusLabel();
  const formatMoney = (amount: number, currency = "USD") =>
    format.number(amount, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const directionLabel = (value: string) =>
    value === "credit" || value === "debit" ? t(`direction.${value}`) : statusLabel(value);
  const sourceLabel = (value: string) =>
    value === "offering" || value === "expense" ? t(`source.${value}`) : statusLabel(value);
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
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          <Badge>
            <span className="tabular-nums">
              {t("range", { start: startItem, end: endItem, total: ledger.pagination.total })}
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
                <span className="tabular-nums text-emerald-700">{formatMoney(account.totalCredits)}</span> {t("in")} ·{" "}
                <span className="tabular-nums text-red-700">{formatMoney(account.totalDebits)}</span> {t("out")}
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
                  <th>{t("headers.date")}</th>
                  <th>{t("headers.branch")}</th>
                  <th>{t("headers.account")}</th>
                  <th>{t("headers.direction")}</th>
                  <th>{t("headers.source")}</th>
                  <th>{t("headers.description")}</th>
                  <th>{t("headers.service")}</th>
                  <th className="text-right">{t("headers.amount")}</th>
                  <th>{t("headers.status")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((entry) => (
                  <tr key={entry._id}>
                    <td className="whitespace-nowrap tabular-nums text-[#55534e]">
                      {date(entry.entryDate)}
                    </td>
                    <td className="text-[#55534e]">{entry.branchId?.name || t("branchFallback")}</td>
                    <td className="text-[#55534e]">{entry.accountLabel}</td>
                    <td>
                      <Badge tone={entry.direction === "credit" ? "success" : "danger"}>
                        {directionLabel(entry.direction)}
                      </Badge>
                    </td>
                    <td className="text-[#55534e]">{sourceLabel(entry.sourceType)}</td>
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
                        {statusLabel(entry.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState icon="finance" title={t("emptyTitle")}>
            {t("emptyBody")}
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
