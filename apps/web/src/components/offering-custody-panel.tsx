"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Card, Field } from "@/components/ui/ui";
import { apiPost } from "@/lib/api";

export type CustodyView = {
  revision: number; currency: string; minorDigits: number; title: string; service: string;
  serviceDate: string; status: string; canIssue: boolean; countPending: boolean; canVerify: boolean; mismatchCount: number;
  bags: { label: string; seal?: string; collector: string; issuedAt: string; receivedAt?: string; canReceive: boolean; issuerName?: string; receiverName?: string }[];
  verifiedMinor?: number;
  counters: { name?: string; at: string }[];
  deposit?: { reference: string; date: string; minor: number; recorderName?: string };
};

type Operation = "issue" | "receive" | "count" | "deposit";

export function OfferingCustodyPanel({ id, custody }: { id: string; custody: CustodyView }) {
  const t = useTranslations("admin.custody");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState<string>();
  const [error, setError] = useState<string>();
  const { currency, minorDigits } = custody;
  const money = (minor: number) => format.number(minor / 10 ** minorDigits, { style: "currency", currency });
  const timestamp = (date: string) => format.dateTime(new Date(date), { dateStyle: "medium", timeStyle: "short" });
  const open = !custody.deposit && custody.status !== "rejected";

  async function submit(event: FormEvent<HTMLFormElement>, operation: Operation) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const amount = typeof data.amount === "string" ? data.amount.trim().replace(",", ".") : "";
    delete data.amount;
    const [units, fraction = ""] = amount.split(".");
    const hasAmount = operation === "count" || operation === "deposit";
    if (hasAmount && (!/^\d+(\.\d+)?$/.test(amount) || fraction.length > minorDigits)) {
      setError(t("invalidAmount"));
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const minor = Number(units + fraction.padEnd(minorDigits, "0"));
      const result = await apiPost<{ mismatch?: boolean }>(`/finance/offerings/${id}/custody/${operation}`, {
        revision: custody.revision, ...data, ...(hasAmount ? { minor } : {}),
      });
      form.reset();
      setReceiving(undefined);
      if (result.mismatch) toast.error(t("recount"));
      else toast.success(t("saved"));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-4">
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">{t("bags")}</h2>
      <p className="text-sm text-neutral-600">{timestamp(custody.serviceDate)}</p>
      {custody.canIssue ? <form className="grid gap-3 sm:grid-cols-3" onSubmit={event => void submit(event, "issue")}>
        <Field label={t("bag")}><input className="ui-input" name="label" required maxLength={80} /></Field>
        <Field label={t("seal")}><input className="ui-input" name="seal" required maxLength={80} /></Field>
        <Field label={t("collector")}><input className="ui-input" name="collector" required maxLength={120} /></Field>
        <Button type="submit" disabled={busy}>{t("issue")}</Button>
      </form> : null}
      {custody.bags.length ? <ul className="divide-y divide-black/10">
        {custody.bags.map(bag => <li className="space-y-2 py-3" key={bag.label}>
          <p className="font-medium">{bag.label} · {bag.collector}</p>
          <p className="text-sm">{[t("issued"), bag.issuerName, timestamp(bag.issuedAt)].filter(Boolean).join(" · ")}</p>
          {bag.receivedAt ? <p className="text-sm">{[t("received"), bag.receiverName, timestamp(bag.receivedAt)].filter(Boolean).join(" · ")}</p> : null}
          {bag.seal ? <p className="text-sm">{t("seal")} · {bag.seal}</p> : null}
          {open && bag.canReceive && receiving !== bag.label ? <Button type="button" size="sm" variant="secondary"
            onClick={() => setReceiving(bag.label)}>{t("receive")}</Button> : null}
          {open && bag.canReceive && receiving === bag.label ? <form className="space-y-2" onSubmit={event => void submit(event, "receive")}>
            <input type="hidden" name="label" value={bag.label} />
            <Field label={t("physicalSeal")}><input className="ui-input" name="seal" required maxLength={80} /></Field>
            <Button type="submit" size="sm" disabled={busy}>{t("receive")}</Button>
          </form> : null}
        </li>)}
      </ul> : <p className="text-sm">{t("noBags")}</p>}
    </Card>
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">{t("counts")}</h2>
      {custody.mismatchCount > 0 && custody.verifiedMinor === undefined ? <p role="status">{t("recount")}</p> : null}
      {custody.verifiedMinor !== undefined ? <p>{t("verified")} · {money(custody.verifiedMinor)}</p> :
        open && custody.bags.length > 0 && custody.bags.every(bag => bag.receivedAt) ?
          !custody.countPending || custody.canVerify ? <form className="space-y-3" onSubmit={event => void submit(event, "count")}>
            <Field label={t("amount", { currency })}><input className="ui-input" name="amount" inputMode="decimal" required maxLength={20} /></Field>
            <Button type="submit" disabled={busy}>{t(custody.canVerify ? "verify" : "count")}</Button>
          </form> : <p>{t("awaiting")}</p> : <p>{t("receiveFirst")}</p>}
      {custody.counters.length ? <ul className="text-sm">
        {custody.counters.map((counter, index) => <li key={index}>{[t(index === 0 ? "count" : "verified"), counter.name, timestamp(counter.at)].filter(Boolean).join(" · ")}</li>)}
      </ul> : null}
    </Card>
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">{t("reconcile")}</h2>
      {custody.deposit ? <p>{[t("reconciled"), money(custody.deposit.minor), custody.deposit.reference, custody.deposit.date, custody.deposit.recorderName].filter(Boolean).join(" · ")}</p> :
        custody.verifiedMinor !== undefined && ["approved", "locked"].includes(custody.status) ?
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={event => void submit(event, "deposit")}>
            <Field label={t("reference")}><input className="ui-input" name="reference" maxLength={120} required /></Field>
            <Field label={tc("date")}><input className="ui-input" name="date" type="date" required /></Field>
            <Field label={t("amount", { currency })}><input className="ui-input" name="amount" inputMode="decimal" maxLength={20} required /></Field>
            <Button type="submit" disabled={busy}>{t("reconcile")}</Button>
          </form> : <p>{t("approveFirst")}</p>}
    </Card>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
  </div>;
}
