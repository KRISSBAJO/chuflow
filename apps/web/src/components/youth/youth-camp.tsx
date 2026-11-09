"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Button, Field } from "@/components/ui/ui";
import { campMajorUnit, campMinorAmount } from "@/lib/youth-camp-money";
import type { YouthGroup } from "@/lib/youth";
import { workspacePublicHref } from "@/lib/workspace-routing";
import { useYouthAction } from "./use-youth-action";

const kinds = ["payment", "scholarship", "refund", "scholarship_reversal"] as const;
type Entry = { requestId: string; kind: (typeof kinds)[number]; amount: number; at: string };
type Person = {
  _id: string; firstName: string; lastName: string; state: "pending" | "active" | "declined" | "withdrawn";
  needsGuardian: boolean; contact?: string; guardianName?: string; transportConsent?: boolean;
  campTransport?: string; campRoom?: string; campPaid?: number; campScholarship?: number;
  campFinanceRevision?: number; campLedger?: Entry[];
};
type Branch = { _id: string; name: string };
type Camp = YouthGroup & { eventDate: string; campEndDate: string; venue: string; currency: string; feeMinor: number; depositMinor: number };
export type CampOverview = {
  group: Camp; coordinator: boolean; options: Branch[]; leaders: { _id: string; firstName: string; lastName: string }[];
  date: string; people: Person[]; finance: boolean; screened: boolean; registrationAvailable: boolean; token: string | null;
  selectedBranch?: string; present: string[]; branches: (Branch & { local: boolean; approved: number; pending: number; guardianPending?: number })[];
};

function CampLedger({ camp, person, path }: { camp: Camp; person: Person; path: string }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const money = (minor: number) => format.number(minor / campMajorUnit(camp.currency), { style: "currency", currency: camp.currency });
  const paid = person.campPaid ?? 0;
  const scholarship = person.campScholarship ?? 0;
  const depositDue = Math.max(0, Math.min(camp.depositMinor, camp.feeMinor - scholarship) - paid);
  return <details className="rounded-lg border border-black/10 p-3">
    <summary className="cursor-pointer text-sm font-semibold">{t("campLedger")}</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p>{t("campBalance", { balance: money(camp.feeMinor - paid - scholarship), deposit: money(depositDue) })}</p>
      <p>{t("campCredits", { paid: money(paid), scholarship: money(scholarship) })}</p>
      {person.campLedger?.length ? <ul className="space-y-1">{[...person.campLedger].reverse().map(entry =>
        <li key={entry.requestId}>{t(`campLedgerKinds.${entry.kind}`)} · {money(entry.amount)} · {format.dateTime(new Date(entry.at), { dateStyle: "medium" })}</li>
      )}</ul> : null}
      <form className="flex flex-wrap items-end gap-3" onSubmit={async event => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        const kind = String(form.get("kind"));
        const amount = campMinorAmount(form.get("amount"), camp.currency);
        if (!amount || amount < 1) { toast.error(t("campAmountInvalid")); return; }
        const fingerprint = JSON.stringify([kind, amount]);
        if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
        if (await run(path + "/ledger", "POST", { requestId: request.current.id, kind, amount, revision: person.campFinanceRevision ?? 0 })) {
          request.current = null;
          element.reset();
        }
      }}>
        <Field label={t("campEntryType")}><select name="kind" className="ui-input">{kinds.filter(kind =>
          (person.state === "active" || person.state === "pending") || kind === "refund" || kind === "scholarship_reversal").map(kind =>
          <option key={kind} value={kind}>{t(`campLedgerKinds.${kind}`)}</option>)}</select></Field>
        <Field label={t("campAmount")}><input name="amount" type="number" step="any" min={0} className="ui-input" required /></Field>
        <Button type="submit" size="sm" disabled={busy}>{t("campRecordEntry")}</Button>
      </form>
    </div>
  </details>;
}

function CampParticipant({ person, data, path }: { person: Person; data: CampOverview; path: string }) {
  const t = useTranslations("youth");
  const { run, busy } = useYouthAction();
  const enrollment = path + "/people/" + person._id;
  const checked = data.present.includes(person._id);
  return <article className="space-y-3 rounded-xl border border-black/10 p-4">
    <h3 className="font-semibold">{person.firstName} {person.lastName} <span className="font-normal text-neutral-600">· {t(`campStates.${person.state}`)}</span></h3>
    <p className="break-words text-sm">{[person.guardianName, person.contact].filter(Boolean).join(" · ")}</p>
    {person.state === "pending" ? <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      void run(enrollment + "/review", "PATCH", { state: "active", guardianVerified: new FormData(event.currentTarget).has("guardian") });
    }}>
      {person.needsGuardian ? <label className="flex items-start gap-2 text-sm"><input name="guardian" type="checkbox" required />{t("guardianVerified")}</label> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !data.screened}>{t("approve")}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void run(enrollment + "/review", "PATCH", { state: "declined" })}>{t("decline")}</Button>
      </div>
    </form> : null}
    {person.state === "active" ? <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" aria-pressed={checked} disabled={busy || !data.screened || data.date > new Date().toISOString().slice(0,10)}
          onClick={() => void run(path + "/attendance", "PATCH", { date: data.date, enrollmentId: person._id, present: !checked })}>{t(checked ? "present" : "markPresent")}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => {
          if (window.confirm(t("withdrawConfirm"))) void run(enrollment + "/withdraw", "PATCH");
        }}>{t("withdraw")}</Button>
      </div>
      <details className="rounded-lg border border-black/10 p-3">
        <summary className="cursor-pointer text-sm font-semibold">{t("campLogistics")}</summary>
        <form className="mt-3 space-y-3" onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run(enrollment + "/logistics", "PATCH", { transport: form.get("transport") ?? "", room: form.get("room") });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("campTransport")} hint={!person.transportConsent ? t("campTransportMissing") : undefined}>
              <input name="transport" className="ui-input" maxLength={120} defaultValue={person.campTransport} disabled={!person.transportConsent} />
            </Field>
            <Field label={t("campRoom")}><input name="room" className="ui-input" maxLength={120} defaultValue={person.campRoom} /></Field>
          </div>
          <Button type="submit" size="sm" disabled={busy}>{t("saveGroup")}</Button>
        </form>
      </details>
    </> : null}
    {data.finance && data.group.feeMinor > 0 && (person.state !== "declined" || person.campLedger?.length) ? <CampLedger camp={data.group} person={person} path={enrollment} /> : null}
  </article>;
}

export function YouthCampWorkspace({ data, workspace }: { data: CampOverview; workspace?: string }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const router = useRouter();
  const { run, busy } = useYouthAction();
  const [qr, setQr] = useState<string>();
  const { group, selectedBranch } = data;
  const base = "/youth/camps/" + group._id;
  const branchPath = base + "/branches/" + selectedBranch;
  const href = data.token && data.registrationAvailable ? workspacePublicHref("/youth-register/" + data.token, workspace) : null;
  const options = data.options.filter(option => !data.branches.some(branch => branch._id === option._id));
  const dateLabel = (date: string) => format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" });
  return <div className="space-y-5">
    <section className="app-card space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("campDelegations")}</h2>
      <p className="text-sm">{dateLabel(group.eventDate)} – {dateLabel(group.campEndDate)}</p>
      {data.coordinator ? <p className="text-sm">{t("eventCapacity", { count: data.branches.reduce((sum, branch) => sum + branch.approved, 0), total: group.capacity ?? 0 })}</p> : null}
      <ul className="divide-y divide-black/10">{data.branches.map(branch => <li key={branch._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
        {branch.local ? <Link href={base + "?branch=" + branch._id} aria-current={branch._id === selectedBranch ? "page" : undefined} className="font-semibold underline">{branch.name}</Link> : <strong>{branch.name}</strong>}
        <span>{t("counts", { active: format.number(branch.approved), pending: format.number(branch.pending) })}
          {branch.guardianPending ? <> · {t("campGuardianPending", { count: branch.guardianPending })}</> : null}</span>
      </li>)}</ul>
      {data.coordinator && options.length ? <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        void run(base + "/branches", "POST", { branchId: new FormData(event.currentTarget).get("branchId") });
      }}>
        <Field label={t("branch")}><select name="branchId" className="ui-input" required defaultValue="">
          <option value="">{t("chooseBranch")}</option>{options.map(option => <option key={option._id} value={option._id}>{option.name}</option>)}
        </select></Field>
        <Button type="submit" disabled={busy}>{t("campAddBranch")}</Button>
      </form> : null}
    </section>
    {data.coordinator ? <section className="app-card space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("leader")}</h2>
      <p className="text-sm">{t("campScreeningHint")}</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run("/youth/groups/" + group._id + "/leader", "PATCH", { leaderId: form.get("leaderId"), clearanceUntil: form.get("clearanceUntil"), screeningVerified: form.has("verified") });
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("leader")}><select name="leaderId" className="ui-input" required defaultValue={group.leaderId ?? ""}>
            <option value="">{t("chooseLeader")}</option>{data.leaders.map(leader => <option key={leader._id} value={leader._id}>{leader.firstName} {leader.lastName}</option>)}
          </select></Field>
          <Field label={t("clearance")}><input name="clearanceUntil" type="date" min={group.campEndDate} className="ui-input" required defaultValue={group.clearanceUntil} /></Field>
        </div>
        <label className="flex items-start gap-2 text-sm"><input name="verified" type="checkbox" required />{t("screeningVerified")}</label>
        <Button type="submit" disabled={busy || !data.leaders.length}>{t("saveLeader")}</Button>
      </form>
    </section> : null}
    {selectedBranch ? <section className="app-card space-y-4 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{data.branches.find(branch => branch._id === selectedBranch)?.name}</h2><p className="text-sm">{t("presentCount", { count: data.present.length })}</p></div>
        <Field label={t("checkInDate")}><input type="date" className="ui-input" min={group.eventDate} max={group.campEndDate} value={data.date} onChange={event => {
          if (event.target.value) router.replace(base + "?" + new URLSearchParams({ branch: selectedBranch, date: event.target.value }), { scroll: false });
        }} /></Field>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        {href ? <>
          <a className="inline-flex min-h-11 items-center text-sm font-semibold underline" href={href}>{t("openRegistration")}</a>
          <Button type="button" variant="secondary" onClick={() => setQr(new URL(href, window.location.origin).href)}>{t("showQr")}</Button>
        </> : null}
        <Button type="button" disabled={busy || (!data.token && !data.registrationAvailable)}
          onClick={() => void run(branchPath + "/link", "PATCH", { enabled: !data.token })}>{t(data.token ? "disableLink" : "enableLink")}</Button>
      </div>
      {href && qr && new URL(qr).pathname + new URL(qr).search === href ? <TemplateQrCard url={qr} title={group.name} /> : null}
      {data.people.length ? data.people.map(person => <CampParticipant key={person._id} person={person} data={data} path={branchPath} />) : <p className="text-sm">{t("noPending")}</p>}
    </section> : null}
  </div>;
}
