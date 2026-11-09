"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { workspacePublicHref } from "@/lib/workspace-routing";
import type { YouthDetail, YouthPerson } from "@/lib/youth";
import { EventFollowUp } from "./event-follow-up";
import { GuardianReminder } from "./guardian-reminder";
import { ParticipantInvite } from "./participant-invite";
import { useYouthAction } from "./use-youth-action";
import { YouthGroupFields, youthGroupValues } from "./youth-setup";

type Match = { _id: string; firstName: string; lastName: string };

function PendingRegistration({ path, person }: { path: string; person: YouthPerson }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [options, setOptions] = useState<{ members: Match[]; children: Match[] }>();
  const [looking, setLooking] = useState(false);
  async function findMatches() {
    setLooking(true);
    try {
      const response = await fetch(API_URL + path + "/matches", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error();
      setOptions(await response.json());
    } catch {
      toast.error(t("failed"));
    } finally {
      setLooking(false);
    }
  }
  return <form className="space-y-3 rounded-xl border border-black/10 p-4" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const [kind, existingId] = String(data.get("existing") ?? "").split(":");
    void run(path, "PATCH", {
      state: "active", guardianVerified: data.has("guardianVerified"),
      ...(kind === "member" ? { memberId: existingId } : {}),
      ...(kind === "child" ? { childId: existingId } : {}),
    });
  }}>
    <p className="font-semibold">{person.firstName} {person.lastName}</p>
    {person.birthDate ? <p className="text-sm">{t("birthDate")} · {format.dateTime(new Date(person.birthDate), { dateStyle: "medium", timeZone: "UTC" })}</p> : null}
    <p className="break-words text-sm text-neutral-700">{[person.guardianName, person.contact].filter(Boolean).join(" · ")}</p>
    {person.consentAt ? <p className="text-sm text-neutral-600">{t("submittedConsent", { version: person.consentVersion ?? 1, date: format.dateTime(new Date(person.consentAt), { dateStyle: "medium" }) })}</p> : null}
    {person.customAnswers?.map(answer => <p key={answer.key} className="break-words text-sm">{answer.label} · {answer.value}</p>)}
    {person.needsGuardian ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="guardianVerified" required />{t("guardianVerified")}</label> : null}
    {options ? <Field label={t("existingRecord")}>
      <select name="existing" className="ui-input"><option value="">{t("enrollmentOnly")}</option>
        {options.members.map(option => <option key={option._id} value={"member:" + option._id}>{t("member")} · {option.firstName} {option.lastName}</option>)}
        {options.children.map(option => <option key={option._id} value={"child:" + option._id}>{t("child")} · {option.firstName} {option.lastName}</option>)}
      </select>
    </Field> : <Button type="button" variant="secondary" disabled={looking || busy} onClick={() => void findMatches()}>{t("findExisting")}</Button>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={busy}>{t("approve")}</Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(path, "PATCH", { state: "declined" })}>{t("decline")}</Button>
    </div>
  </form>;
}

function TransitionForm({ path, person, destinations }: { path: string; person: YouthPerson; destinations: YouthDetail["destinations"] }) {
  const t = useTranslations("youth");
  const locale = useLocale();
  const { run, busy } = useYouthAction();
  const [destinationId, setDestinationId] = useState("");
  if (!person.birthDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const age = Number(today.slice(0, 4)) - Number(person.birthDate.slice(0, 4)) - (today.slice(5) < person.birthDate.slice(5) ? 1 : 0);
  const eligible = destinations.filter(group => group.minAge <= age && age <= group.maxAge);
  if (!eligible.length) return null;
  const destination = eligible.find(group => group._id === destinationId);
  const guardian = destination && age < destination.guardianUnderAge;
  return <details className="w-full">
    <summary className="cursor-pointer text-sm font-medium">{t("transition")}</summary>
    <form className="mt-3 space-y-3" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void run(path + "/transition", "POST", {
        destinationId, contact: form.get("contact"), ...(guardian ? { guardianName: form.get("guardianName") } : {}),
        consent: form.has("consent"), consentVersion: 1, locale,
      });
    }}>
      <p className="text-sm text-neutral-600">{t("transitionHint")}</p>
      <Field label={t("groupName")}><select value={destinationId} required className="ui-input" onChange={event => setDestinationId(event.target.value)}>
        <option value="">{t("chooseGroup")}</option>
        {eligible.map(group => <option key={group._id} value={group._id}>{group.name}</option>)}
      </select></Field>
      {destination ? <div key={destinationId} className="space-y-3">
        {guardian ? <Field label={t("guardianName")}><input name="guardianName" className="ui-input" maxLength={160} required /></Field> : null}
        <Field label={t(guardian ? "guardianContact" : "contact")}><input name="contact" className="ui-input" maxLength={120} required /></Field>
        <label className="flex items-start gap-2 text-sm"><input name="consent" type="checkbox" required />{t(guardian ? "transitionGuardian" : "transitionAdult")}</label>
        <Button type="submit" disabled={busy}>{t("transition")}</Button>
      </div> : null}
    </form>
  </details>;
}

export function YouthGroupWorkspace({ data, workspace }: { data: YouthDetail; workspace?: string }) {
  const { group, manager, date, people, leaders, destinations, canRecord, registrationToken, present, recentSessions } = data;
  const t = useTranslations("youth");
  const format = useFormatter();
  const router = useRouter();
  const { run, busy } = useYouthAction();
  const path = "/youth/groups/" + group._id;
  const [qrLink, setQrLink] = useState<string>();
  const [onlyOpen, setOnlyOpen] = useState(false);
  const registrationAvailable = data.registrationAvailable ?? canRecord;
  const href = registrationToken && registrationAvailable ? workspacePublicHref("/youth-register/" + registrationToken, workspace) : null;
  const pending = people.filter(person => person.state === "pending");
  const active = people.filter(person => person.state === "active");
  const current = new Set(present);
  const eventFull = group.capacity !== undefined && active.length >= group.capacity;
  const openFollowUps = active.filter(person => person.campFollowUp?.outcome === "open")
    .sort((a, b) => a.campFollowUp!.dueDate.localeCompare(b.campFollowUp!.dueDate));
  const followUpRoster = onlyOpen ? openFollowUps : active;
  return <div className="space-y-5">
    {group.eventDate && group.registrationDeadline ? <section className="app-card space-y-1 p-5 text-sm">
      <p><strong>{t("eventDate")}</strong> · {format.dateTime(new Date(group.eventDate), { dateStyle: "medium", timeZone: "UTC" })} · {group.venue}</p>
      <p><strong>{t("registrationDeadline")}</strong> · {format.dateTime(new Date(group.registrationDeadline), { dateStyle: "medium", timeZone: "UTC" })}</p>
      {group.capacity ? <p>{t("eventCapacity", { count: active.length, total: group.capacity })}</p> : null}
      {eventFull ? <p role="status">{t("eventFull")}</p> : null}
    </section> : null}
    <section className="app-card space-y-4 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{t("attendance")}</h2><p className="text-sm text-neutral-600">{t("presentCount", { count: present.length })}</p></div>
        {!group.eventDate ? <Field label={t("sessionDate")}><input type="date" className="ui-input" value={date} onChange={event => {
          if (event.target.value) router.replace("?date=" + event.target.value, { scroll: false });
        }} /></Field> : null}
      </header>
      {!canRecord ? <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-950">{t("needsLeader")}</p> : null}
      {active.length ? <ul className="divide-y divide-black/10">
        {active.map(person => <li key={person._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="font-medium">{person.firstName} {person.lastName}</span>
          {group.eventDate && group.eventDate >= new Date().toISOString().slice(0, 10) ? <GuardianReminder person={person} path={path + "/people/" + person._id} /> : null}
          <Button type="button" variant="secondary" aria-pressed={current.has(person._id)} disabled={busy || !canRecord || (Boolean(group.eventDate) && date > new Date().toISOString().slice(0, 10))}
            onClick={() => void run(path + "/attendance", "PATCH", { date, enrollmentId: person._id, present: !current.has(person._id) })}>
            {t(current.has(person._id) ? "present" : "markPresent")}
          </Button>
        </li>)}
      </ul> : <p className="text-sm text-neutral-600">{t("noPeople")}</p>}
      {recentSessions.length ? <details><summary className="cursor-pointer text-sm font-semibold">{t("recentSessions")}</summary>
        <ul className="mt-2 space-y-2 text-sm">{recentSessions.map(session => <li key={session.date}>
          {format.dateTime(new Date(session.date), { dateStyle: "medium", timeZone: "UTC" })} · {t("presentCount", { count: session.count })}
        </li>)}</ul></details> : null}
    </section>
    {data.followUpOwners && (data.attendanceRecorded || openFollowUps.length > 0) ? <section className="app-card space-y-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("campFollowUp.heading")}</h2>
        <Button type="button" size="sm" variant="secondary" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(!onlyOpen)}>
          {onlyOpen ? t("campFollowUp.all") : t("campFollowUp.inbox", { count: openFollowUps.length })}
        </Button>
      </header>
      {followUpRoster.length ? followUpRoster.map(person => <div key={person._id} className="space-y-2">
        <p className="text-sm font-semibold">{person.firstName} {person.lastName}</p>
        <EventFollowUp person={person} data={data} path={path + "/people/" + person._id} />
      </div>) : <p className="text-sm text-neutral-600">{t("campFollowUp.empty")}</p>}
    </section> : null}
    <section className="app-card space-y-3 p-5">
      <h2 className="text-lg font-semibold">{t("welcome")}</h2>
      {active.some(person => !person.welcomedAt) ? active.filter(person => !person.welcomedAt).map(person =>
        <div key={person._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 py-2">
          <span>{person.firstName} {person.lastName}</span>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(path + "/people/" + person._id + "/welcome", "POST")}>{t("markWelcomed")}</Button>
        </div>) : <p className="text-sm text-neutral-600">{t("noWelcome")}</p>}
    </section>
    {manager ? <>
      {!group.eventDate ? <details className="app-card p-5">
        <summary className="cursor-pointer font-semibold">{t("groupSettings")}</summary>
        <form className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault();
          void run(path + "/settings", "PATCH", youthGroupValues(new FormData(event.currentTarget)));
        }}>
          <p className="text-sm text-neutral-600">{t("eligibilityHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2"><YouthGroupFields group={group} /></div>
          <Button type="submit" disabled={busy}>{t("saveGroup")}</Button>
        </form>
      </details> : null}
      <section className="app-card space-y-4 p-5">
        <h2 className="text-lg font-semibold">{t("registration")}</h2>
        <p className="text-sm text-neutral-600">{t("registrationHint")}</p>
        {registrationToken ? <div className="flex flex-wrap gap-2">
          {href ? <>
            <a href={href} className="inline-flex min-h-11 items-center text-sm font-semibold underline">{t("openRegistration")}</a>
            <Button type="button" variant="secondary" onClick={() => setQrLink(new URL(href, window.location.origin).href)}>{t("showQr")}</Button>
          </> : null}
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(path + "/link", "DELETE")}>{t("disableLink")}</Button>
        </div> : <Button type="button" disabled={busy || !registrationAvailable} onClick={() => void run(path + "/link", "POST")}>{t("enableLink")}</Button>}
        {href && qrLink && new URL(qrLink).pathname + new URL(qrLink).search === href ? <TemplateQrCard url={qrLink} title={group.name} /> : null}
        <h3 className="font-semibold">{t("reviewQueue")}</h3>
        {pending.length ? pending.map(person => <PendingRegistration key={person._id} path={path + "/people/" + person._id} person={person} />)
          : <p className="text-sm text-neutral-600">{t("noPending")}</p>}
      </section>
      <section className="app-card p-5">
        <h2 className="text-lg font-semibold">{t("leader")}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t("leaderHint")}</p>
        <form key={group.leaderId + ":" + group.clearanceUntil} className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run(path + "/leader", "PATCH", { leaderId: form.get("leaderId"), clearanceUntil: form.get("clearanceUntil"), screeningVerified: form.has("screeningVerified") });
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("leader")}><select name="leaderId" className="ui-input" required defaultValue={group.leaderId ?? ""}>
              <option value="">{t("chooseLeader")}</option>
              {leaders.map(leader => <option key={leader._id} value={leader._id}>{leader.firstName} {leader.lastName}</option>)}
            </select></Field>
            <Field label={t("clearance")}><input name="clearanceUntil" className="ui-input" type="date" required defaultValue={group.clearanceUntil} /></Field>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="screeningVerified" required />{t("screeningVerified")}</label>
          <Button type="submit" disabled={busy || !leaders.length}>{t("saveLeader")}</Button>
        </form>
      </section>
      {active.length ? <details className="app-card p-5">
        <summary className="cursor-pointer font-semibold">{t("manageRoster")}</summary>
        <ul className="mt-3 divide-y divide-black/10">
          {active.map(person => <li key={person._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>{person.firstName} {person.lastName}</span>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => {
              if (window.confirm(t("withdrawConfirm"))) void run(path + "/people/" + person._id + "/withdraw", "POST");
            }}>{t("withdraw")}</Button>
            <TransitionForm path={path + "/people/" + person._id} person={person} destinations={destinations} />
            {!group.eventDate ? <ParticipantInvite path={path + "/people/" + person._id} /> : null}
          </li>)}
        </ul>
      </details> : null}
    </> : null}
  </div>;
}
