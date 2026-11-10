"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { useYouthAction } from "./use-youth-action";
import { API_URL } from "@/lib/api";
import { GroupChat } from "./group-chat";
import { MentoringEmail } from "./mentoring-email";

type Person = { _id: string; firstName: string; lastName: string; needsGuardian: boolean; mentoringEmailConsentAt?: string };
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
  nextCheckIn?: string;
  participantNextStep?: string;
  mentoringEmailDates?: string[];
  active?: boolean;
};
type Progress = { activityId: string; enrollmentId: string; completed: number[]; signedUpAt?: string; serviceMinutes?: number };
type YouthPost = { _id: string; kind: "update" | "devotional" | "program" | "poll"; title: string; body: string; createdAt: string;
  sunday?: string; scripture?: string; question?: string; resourceUrl?: string; resourceFileName?: string; pollOptions?: string[]; pollClosedAt?: string };
export type YouthDevelopmentOverview = {
  groupName: string; manager: boolean; screenedLeader: boolean; people: Person[]; activities: Activity[]; progress: Progress[];
  posts?: YouthPost[];
  pdfUploadsEnabled?: boolean;
  rollout?: { mentoringEmailEnabled: boolean; youthFeedEnabled: boolean };
};

function RolloutControls({ path, rollout }: { path: string; rollout: NonNullable<YouthDevelopmentOverview["rollout"]> }) {
  const t = useTranslations("youth.mentoringEmail");
  const { run, busy } = useYouthAction();
  return <details className="app-card p-5">
    <summary className="cursor-pointer font-semibold">{t("rollout")}</summary>
    <form key={String(rollout.mentoringEmailEnabled) + String(rollout.youthFeedEnabled)} className="mt-4 space-y-3"
      onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        void run(path + "/rollout", "PATCH", { mentoringEmailEnabled: fields.has("email"), youthFeedEnabled: fields.has("feed") });
      }}>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="feed" defaultChecked={rollout.youthFeedEnabled} />{t("rolloutFeed")}</label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="email" defaultChecked={rollout.mentoringEmailEnabled} />{t("rolloutEmail")}</label>
      <Button type="submit" size="sm" disabled={busy}>{t("rolloutSave")}</Button>
    </form>
  </details>;
}
function GroupPosts({ path, posts, pdfUploadsEnabled }: { path: string; posts: YouthPost[]; pdfUploadsEnabled?: boolean }) {
  const t = useTranslations("youth.posts");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [kind, setKind] = useState<YouthPost["kind"]>("update");
  return <div className="space-y-4">
    <form className="app-card space-y-3 p-5" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values: Record<string, unknown> = Object.fromEntries(new FormData(form));
      if (!values.resourceUrl) delete values.resourceUrl;
      if (kind === "poll") values.pollOptions = String(values.pollOptions ?? "").split(/\r?\n/).map(option => option.trim()).filter(Boolean);
      if (await run(path, "POST", values)) {
        form.reset();
        setKind("update");
      }
    }}>
      <h2 className="font-semibold">{t("publish")}</h2>
      <Field label={t("kind")}><select name="kind" className="ui-input" value={kind} onChange={event => setKind(event.target.value as YouthPost["kind"])}>
        <option value="update">{t("update")}</option><option value="devotional">{t("devotional")}</option>
        <option value="program">{t("program")}</option>
        <option value="poll">{t("poll")}</option>
      </select></Field>
      <Field label={t("title")}><input name="title" className="ui-input" maxLength={100} required /></Field>
      <Field label={t("body")}><textarea name="body" className="ui-input" rows={5} maxLength={3000} required /></Field>
      {kind === "program" ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("sunday")}><input name="sunday" type="date" className="ui-input" required /></Field>
          <Field label={t("scripture")}><input name="scripture" className="ui-input" maxLength={120} /></Field>
        </div>
        <Field label={t("question")}><textarea name="question" className="ui-input" rows={2} maxLength={300} /></Field>
        <Field label={t("resource")}><input name="resourceUrl" type="url" className="ui-input" placeholder="https://" maxLength={500} /></Field>
      </> : null}
      {kind === "poll" ? <Field label={t("pollOptions")} hint={t("pollHint")}>
        <textarea name="pollOptions" className="ui-input" rows={4} maxLength={605} required />
      </Field> : null}
      <Button type="submit" disabled={busy}>{t("publish")}</Button>
    </form>
    {posts.length ? posts.map(post => <article className="app-card space-y-2 p-5" key={post._id}>
      <p className="text-sm text-neutral-600">{t(post.kind)} · {format.dateTime(new Date(post.createdAt), { dateStyle: "medium" })}</p>
      <h3 className="font-semibold">{post.title}</h3>
      {post.sunday ? <p className="text-sm">{format.dateTime(new Date(post.sunday), { dateStyle: "medium", timeZone: "UTC" })}</p> : null}
      {post.scripture ? <p className="text-sm font-medium">{post.scripture}</p> : null}
      <p className="whitespace-pre-wrap break-words text-sm">{post.body}</p>
      {post.resourceUrl?.startsWith("https://") ? <a className="inline-flex min-h-11 items-center text-sm underline"
        href={post.resourceUrl} target="_blank" rel="noopener noreferrer">{t("resource")}</a> : null}
      {post.kind === "program" && pdfUploadsEnabled ? <ProgramPdf path={path + "/" + post._id + "/pdf"} name={post.resourceFileName} /> : null}
      {post.question ? <><p className="text-sm font-medium">{post.question}</p>
        <ProgramResponses path={path + "/" + post._id + "/responses"} /></> : null}
      {post.kind === "poll" ? <PollResults path={path + "/" + post._id} post={post} /> : null}
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => {
        if (window.confirm(t("archiveConfirm"))) void run(path + "/" + post._id, "DELETE");
      }}>{t("archive")}</Button>
    </article>) : <p className="app-card p-5 text-sm text-neutral-600">{t("empty")}</p>}
  </div>;
}

function ProgramPdf({ path, name }: { path: string; name?: string }) {
  const t = useTranslations("youth.posts");
  const router = useRouter();
  const { run, busy } = useYouthAction();
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<"pdfFailed" | "pdfUnavailable">();
  return <form className="space-y-2" onSubmit={async event => {
    event.preventDefault();
    if (uploading) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    setUploading(true);
    setFailure(undefined);
    try {
      const response = await fetch(API_URL + path, { method: "POST", credentials: "include", body });
      if (response.ok) {
        form.reset();
        router.refresh();
      } else setFailure(response.status === 503 ? "pdfUnavailable" : "pdfFailed");
    } catch { setFailure("pdfFailed"); }
    finally { setUploading(false); }
  }}>
    {name ? <p className="break-words text-sm">{name}</p> : null}
    <Field label={t("pdf")}><input className="ui-input" name="file" type="file" accept=".pdf,application/pdf" required /></Field>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={uploading || busy}>{t("pdfUpload")}</Button>
      {name ? <Button type="button" size="sm" variant="secondary" disabled={uploading || busy}
        onClick={() => void run(path, "DELETE")}>{t("pdfRemove")}</Button> : null}
    </div>
    {failure ? <p role="alert" className="text-sm">{t(failure)}</p> : null}
  </form>;
}

function PollResults({ path, post }: { path: string; post: YouthPost }) {
  const t = useTranslations("youth.posts");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [counts, setCounts] = useState<number[]>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="space-y-2">
    <p className="text-sm font-medium">{t(post.pollClosedAt ? "pollClosed" : "pollOpen")}</p>
    <ul className="space-y-1 text-sm">{post.pollOptions?.map((option, index) =>
      <li key={option}>{option}{counts ? " · " + format.number(counts[index] ?? 0) : ""}</li>)}</ul>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={async () => {
        setLoading(true);
        setFailed(false);
        try {
          const response = await fetch(API_URL + path + "/poll-results", { credentials: "include", cache: "no-store" });
          if (!response.ok) throw new Error();
          setCounts((await response.json()).counts);
        } catch { setFailed(true); }
        finally { setLoading(false); }
      }}>{t("pollResults")}</Button>
      {!post.pollClosedAt ? <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => {
        if (window.confirm(t("pollCloseConfirm"))) void run(path + "/close-poll", "PATCH");
      }}>{t("pollClose")}</Button> : null}
    </div>
    {failed ? <p role="alert" className="text-sm">{t("responsesFailed")}</p> : null}
  </div>;
}

function ProgramResponses({ path }: { path: string }) {
  const t = useTranslations("youth.posts");
  const [rows, setRows] = useState<{ id: string; name?: string; answer: string }[]>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="space-y-2">
    <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(API_URL + path, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error();
        setRows(await response.json());
      } catch { setFailed(true); }
      finally { setLoading(false); }
    }}>{t("responses")}</Button>
    {failed ? <p role="alert" className="text-sm">{t("responsesFailed")}</p> : null}
    {rows?.length ? <ul className="space-y-2 text-sm">{rows.map(row => <li className="rounded-lg bg-neutral-50 p-3" key={row.id}>
      {row.name ? <p className="font-medium">{row.name}</p> : null}<p className="whitespace-pre-wrap break-words">{row.answer}</p>
    </li>)}</ul> : rows ? <p className="text-sm">{t("noResponses")}</p> : null}
  </div>;
}

function PersonOptions({ people }: { people: Person[] }) {
  const t = useTranslations("youth");
  return <><option value="">{t("chooseParticipant")}</option>
    {people.map(person => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}
  </>;
}

function ProgressCard({ item, people, records, path, manager }: { item: Activity; people: Person[]; records: Progress[]; path: string; manager: boolean }) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [participant, setParticipant] = useState("");
  const milestones = item.milestones ?? [t("serviceCompleted")];
  const selected = people.some(person => person._id === participant) ? participant : "";
  const selectedRecord = records.find(row => row.enrollmentId === selected);
  const completed = selectedRecord?.completed ?? [];
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
    {manager && item.kind === "project" && selected && completed.includes(0) && !future ? <form
      key={selected + ":" + (selectedRecord?.serviceMinutes ?? 0)} className="space-y-2 border-t border-black/10 pt-3"
      onSubmit={event => {
        event.preventDefault();
        const minutes = Number(new FormData(event.currentTarget).get("minutes"));
        void run(path + "/" + item._id + "/service-minutes", "PATCH", { enrollmentId: selected, minutes });
      }}>
      <Field label={t("serviceLog.minutes")} hint={t("serviceLog.hint")}>
        <input className="ui-input" name="minutes" type="number" min={0} max={1440} step={1} required
          defaultValue={selectedRecord?.serviceMinutes ?? ""} />
      </Field>
      <Button type="submit" size="sm" disabled={busy}>{t("serviceLog.save")}</Button>
    </form> : null}
    {future ? <p className="text-sm text-neutral-600">{t("projectDateHint")}</p> : null}
  </article>;
}

function MentoringCard({ item, person, manager, path, emailEnabled }: {
  item: Activity; person?: Person; manager: boolean; path: string; emailEnabled?: boolean;
}) {
  const t = useTranslations("youth");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const today = new Date().toISOString().slice(0, 10);
  const reminderPath = path + "/" + item._id + "/reminder";
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
      <Field label={t("checkInDate")}><input className="ui-input" type="date" name="date" max={today} required /></Field>
      <Button type="submit" disabled={busy}>{t("logCheckIn")}</Button>
    </form> : null}
    {item.canCheckIn ? <details className="rounded-xl border border-black/10 p-3">
      <summary className="cursor-pointer text-sm font-semibold">{t("mentoringReminder.title")}{item.nextCheckIn ? " · " +
        format.dateTime(new Date(item.nextCheckIn), { dateStyle: "medium", timeZone: "UTC" }) : ""}</summary>
      <form key={(item.nextCheckIn ?? "") + ":" + (item.participantNextStep ?? "")} className="mt-3 space-y-3" onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        void run(reminderPath, "PATCH", { date: fields.get("date"), nextStep: fields.get("nextStep") });
      }}>
        <Field label={t("mentoringReminder.date")}>
          <input className="ui-input" name="date" type="date" min={today} defaultValue={item.nextCheckIn} required />
        </Field>
        <Field label={t("mentoringReminder.nextStep")} hint={t("mentoringReminder.visible")}>
          <input className="ui-input" name="nextStep" maxLength={180} defaultValue={item.participantNextStep} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy}>{t("mentoringReminder.save")}</Button>
          {item.nextCheckIn ? <Button type="button" size="sm" variant="secondary" disabled={busy}
            onClick={() => void run(reminderPath, "PATCH", { date: null })}>{t("mentoringReminder.clear")}</Button> : null}
        </div>
      </form>
    </details> : null}
    {manager && item.canCheckIn && emailEnabled && person ? <MentoringEmail key={person._id}
      path={path} activityId={item._id} personId={person._id} guardian={person.needsGuardian}
      optedIn={Boolean(person.mentoringEmailConsentAt)} date={item.nextCheckIn}
      attempted={Boolean(item.nextCheckIn && item.mentoringEmailDates?.includes(item.nextCheckIn))} /> : null}
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
  const [view, setView] = useState<(typeof sections)[number]["kind"] | "posts" | "chat">("track");
  const section = sections.find(item => item.kind === view) ?? sections[0];
  const path = "/youth/groups/" + groupId + "/development";
  const activities = data.activities.filter(item => item.kind === view);
  return <div className="space-y-5">
    <nav aria-label={t("development")} className="flex flex-wrap gap-2">
      {sections.map(item => <Button key={item.kind} type="button" size="sm" variant={view === item.kind ? "primary" : "secondary"}
        aria-pressed={view === item.kind} onClick={() => setView(item.kind)}>{t(item.label)}</Button>)}
      {data.manager ? <Button type="button" size="sm" variant={view === "posts" ? "primary" : "secondary"}
        aria-pressed={view === "posts"} onClick={() => setView("posts")}>{t("posts.heading")}</Button> : null}
      {data.manager ? <Button type="button" size="sm" variant={view === "chat" ? "primary" : "secondary"}
        aria-pressed={view === "chat"} onClick={() => setView("chat")}>{t("chat.heading")}</Button> : null}
    </nav>
    {data.manager && data.rollout ? <RolloutControls path={path} rollout={data.rollout} /> : null}
    {view === "chat" && data.manager ? <GroupChat key={groupId} path={path + "/chat"} /> : view === "posts" && data.manager ? <GroupPosts path={path + "/posts"} posts={data.posts ?? []} pdfUploadsEnabled={data.pdfUploadsEnabled} /> : <>
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
      <MentoringCard key={item._id} item={item} path={path} manager={data.manager} emailEnabled={data.rollout?.mentoringEmailEnabled}
        person={data.people.find(person => person._id === item.enrollmentId)} /> :
      <ProgressCard key={item._id} item={item} path={path} manager={data.manager} people={data.people} records={data.progress.filter(row => row.activityId === item._id)} />) :
      <p className="app-card p-5 text-sm text-neutral-600">{t("noDevelopment")}</p>}
    </>}
  </div>;
}
