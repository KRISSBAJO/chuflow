"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { useYouthAction } from "./use-youth-action";

type Person = { _id: string; firstName: string; lastName: string; needsGuardian: boolean };
type Activity = {
  _id: string;
  kind: "track" | "project" | "mentoring";
  title: string;
  milestones?: string[];
  date?: string;
  location?: string;
  enrollmentId?: string;
  mentorName?: string;
  canCheckIn?: boolean;
  checkIns?: string[];
  active?: boolean;
};
type Progress = { activityId: string; enrollmentId: string; completed: number[]; signedUpAt?: string };
export type YouthDevelopmentOverview = {
  groupName: string; manager: boolean; screenedLeader: boolean; people: Person[]; activities: Activity[]; progress: Progress[];
};

function PersonOptions({ people }: { people: Person[] }) {
  const t = useTranslations("youth");
  return <><option value="">{t("chooseParticipant")}</option>
    {people.map(person => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}
  </>;
}

function ProgressCard({ item, people, records, path }: { item: Activity; people: Person[]; records: Progress[]; path: string }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [participant, setParticipant] = useState("");
  const milestones = item.milestones ?? [t("serviceCompleted")];
  const selected = people.some(person => person._id === participant) ? participant : "";
  const completed = records.find(row => row.enrollmentId === selected)?.completed ?? [];
  const completeCount = records.filter(row => row.completed.length === milestones.length).length;
  const future = Boolean(item.date && item.date > new Date().toISOString().slice(0, 10));
  const signups = item.kind === "project" ? people.filter(person => records.some(row => row.enrollmentId === person._id && row.signedUpAt)) : [];
  return <article className="app-card space-y-3 p-5">
    <h3 className="font-semibold">{item.title}</h3>
    {item.date ? <p className="text-sm">{format.dateTime(new Date(item.date), { dateStyle: "medium", timeZone: "UTC" })} · {item.location}</p> : null}
    <p className="text-sm text-neutral-600">{t("completedCount", { count: completeCount, total: people.length })}</p>
    {signups.length ? <details className="text-sm">
      <summary className="cursor-pointer font-medium">{t("participantInvite.projectSignups", { count: signups.length })}</summary>
      <ul className="mt-2 space-y-1">{signups.map(person => <li key={person._id}>{person.firstName} {person.lastName}</li>)}</ul>
    </details> : null}
    <Field label={t("participant")}><select value={selected} className="ui-input" onChange={event => setParticipant(event.target.value)}><PersonOptions people={people} /></select></Field>
    <ul className="divide-y divide-black/10">
      {milestones.map((milestone, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span>{milestone}</span>
        {selected ? <Button type="button" size="sm" variant="secondary" disabled={busy || future} aria-pressed={completed.includes(index)}
          onClick={() => void run(path + "/" + item._id + "/progress", "PATCH", { enrollmentId: selected, milestone: index, completed: !completed.includes(index) })}>
          {t(completed.includes(index) ? "undoCompletion" : "markComplete")}
        </Button> : null}
      </li>)}
    </ul>
    {future ? <p className="text-sm text-neutral-600">{t("projectDateHint")}</p> : null}
  </article>;
}

function MentoringCard({ item, person, manager, path }: { item: Activity; person?: Person; manager: boolean; path: string }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  return <article className="app-card space-y-3 p-5">
    <h3 className="font-semibold">{item.title}</h3>
    <p className="text-sm">{person?.firstName} {person?.lastName} · {t("mentorLabel", { name: item.mentorName || t("mentorUnavailable") })}</p>
    <p className="text-sm text-neutral-600">{t(item.active ? item.canCheckIn ? "mentoringActive" : "mentoringPaused" : "mentoringEnded")}</p>
    {item.checkIns?.length ? <ul className="space-y-1 text-sm">{[...item.checkIns].sort().reverse().map(date =>
      <li key={date}>{format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" })}</li>
    )}</ul> : <p className="text-sm">{t("noCheckIns")}</p>}
    {item.canCheckIn ? <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      void run(path + "/" + item._id + "/check-ins", "POST", { date: new FormData(event.currentTarget).get("date") });
    }}>
      <Field label={t("checkInDate")}><input className="ui-input" type="date" name="date" max={new Date().toISOString().slice(0, 10)} required /></Field>
      <Button type="submit" disabled={busy}>{t("logCheckIn")}</Button>
    </form> : null}
    {manager && item.active ? <Button type="button" variant="secondary" disabled={busy} onClick={() => {
      if (window.confirm(t("endMentoringConfirm"))) void run(path + "/" + item._id + "/end", "PATCH");
    }}>{t("endMentoring")}</Button> : null}
  </article>;
}

const sections = [
  { kind: "track", label: "tracks", endpoint: "tracks", create: "createTrack" },
  { kind: "mentoring", label: "mentoring", endpoint: "mentoring", create: "createMentoring" },
  { kind: "project", label: "projects", endpoint: "projects", create: "createProject" },
] as const;

export function YouthDevelopmentWorkspace({ groupId, data }: { groupId: string; data: YouthDevelopmentOverview }) {
  const t = useTranslations("youth");
  const { run, busy } = useYouthAction();
  const [view, setView] = useState<(typeof sections)[number]["kind"]>("track");
  const section = sections.find(item => item.kind === view)!;
  const path = "/youth/groups/" + groupId + "/development";
  const activities = data.activities.filter(item => item.kind === view);
  return <div className="space-y-5">
    <nav aria-label={t("development")} className="flex flex-wrap gap-2">
      {sections.map(item => <Button key={item.kind} type="button" size="sm" variant={view === item.kind ? "primary" : "secondary"}
        aria-pressed={view === item.kind} onClick={() => setView(item.kind)}>{t(item.label)}</Button>)}
    </nav>
    {data.manager ? <details key={view} className="app-card p-5">
      <summary className="cursor-pointer font-semibold">{t(section.create)}</summary>
      <form className="mt-4 space-y-4" onSubmit={async event => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        const title = form.get("title");
        const body = view === "track" ? { title, milestones: String(form.get("milestones")).split(/\r?\n/).map(item => item.trim()).filter(Boolean) } :
          view === "project" ? { title, date: form.get("date"), location: form.get("location") } :
            { title, enrollmentId: form.get("enrollmentId"), permissionConfirmed: form.has("permissionConfirmed") };
        if (await run(path + "/" + section.endpoint, "POST", body)) element.reset();
      }}>
        {view === "mentoring" ? <p className="text-sm text-neutral-600">{t("mentoringHint")}</p> : null}
        <Field label={t(view === "mentoring" ? "mentoringFocus" : "activityTitle")}><input className="ui-input" name="title" maxLength={100} required /></Field>
        {view === "track" ? <Field label={t("milestones")} hint={t("milestonesHint")}><textarea className="ui-input" name="milestones" rows={4} maxLength={1514} required /></Field> : null}
        {view === "project" ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("projectDate")}><input className="ui-input" name="date" type="date" required /></Field>
          <Field label={t("venue")}><input className="ui-input" name="location" maxLength={160} required /></Field>
        </div> : null}
        {view === "mentoring" ? <>
          <Field label={t("participant")}><select className="ui-input" name="enrollmentId" required><PersonOptions people={data.people} /></select></Field>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="permissionConfirmed" required />{t("mentoringPermission")}</label>
          {!data.screenedLeader ? <p className="text-sm text-orange-800">{t("mentoringScreening")}</p> : null}
        </> : null}
        <Button type="submit" disabled={busy || (view === "mentoring" && (!data.screenedLeader || !data.people.length))}>{t(section.create)}</Button>
      </form>
    </details> : null}
    {activities.length ? activities.map(item => item.kind === "mentoring" ?
      <MentoringCard key={item._id} item={item} path={path} manager={data.manager} person={data.people.find(person => person._id === item.enrollmentId)} /> :
      <ProgressCard key={item._id} item={item} path={path} people={data.people} records={data.progress.filter(row => row.activityId === item._id)} />) :
      <p className="app-card p-5 text-sm text-neutral-600">{t("noDevelopment")}</p>}
  </div>;
}
