"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Card, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

const statuses = ["new", "praying", "follow_up", "answered", "closed"] as const;
type Status = (typeof statuses)[number];
type Assignee = { _id: string; firstName: string; lastName: string; branchId: string };
type Item = {
  id: string;
  name: string;
  branch?: { _id: string; name: string };
  request: string;
  status: Status;
  revision: number;
  assigneeId: string | null;
  contactAllowed: boolean;
  phone?: string;
  createdAt?: string;
  dueDate?: string | null;
};
type Timeline = { receivedAt?: string; events: { at: string; actor: string; note?: string; status?: Status; assignee?: string | null; dueDate?: string | null }[] };
export type PrayerCareQueue = { page: number; totalPages: number; canAssign: boolean; items: Item[]; assignees: Assignee[] };

export function PrayerCareCard({ item, assignees }: { item: Item; assignees?: Assignee[] }) {
  const t = useTranslations("people.prayerCare");
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({ revision: item.revision, status: item.status });
  const [note, setNote] = useState("");
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [timelineState, setTimelineState] = useState<"closed" | "loading" | "open" | "error">("closed");
  const status = selected.revision === item.revision ? selected.status : item.status;
  const endpoint = API_URL + "/guests/prayer-care/" + encodeURIComponent(item.id);
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));

  async function loadTimeline() {
    setTimelineState("loading");
    try {
      const response = await fetch(endpoint + "/timeline", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error();
      setTimeline(await response.json() as Timeline);
      setTimelineState("open");
    } catch {
      setTimeline(null);
      setTimelineState("error");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const assignee = form.get("assigneeId");
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          revision: item.revision, status,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(status === "follow_up" ? { dueDate: form.get("dueDate") || null } : {}),
          ...(typeof assignee === "string" && assignee !== (item.assigneeId ?? "") ? { assigneeId: assignee || null } : {}),
        }),
      });
      if (!response.ok) {
        toast.error(t(response.status === 409 ? "conflict" : "failed"));
        if (response.status === 409) {
          if (timelineState !== "closed") void loadTimeline();
          router.refresh();
        }
        return;
      }
      setNote("");
      if (timelineState !== "closed") void loadTimeline();
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <header>
        <h2 className="lp-heading text-xl">{item.name}</h2>
        <p className="text-sm text-neutral-600">{[item.branch?.name, item.createdAt ? new Date(item.createdAt).toLocaleDateString(locale) : ""].filter(Boolean).join(" · ")}</p>
      </header>
      <p className="whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-sm leading-relaxed">{item.request}</p>
      <p className="text-sm text-neutral-700">
        {t(item.contactAllowed ? "contactAllowed" : "privateOnly")}
        {item.phone ? <a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`} className="ml-2 underline">{item.phone}</a> : null}
      </p>
      {item.dueDate ? <p className="text-sm font-medium">{t("dueOn", { date: dateLabel(item.dueDate) })}</p> : null}
      <form onSubmit={save} className="space-y-3">
        <div key={item.revision} className="grid items-end gap-3 sm:grid-cols-2">
          <Field label={t("statusLabel")}>
            <select name="status" value={status} onChange={(event) => setSelected({ revision: item.revision, status: event.target.value as Status })} className="ui-input">
              {statuses.filter((status) => status !== "follow_up" || item.contactAllowed || item.status === status).map((status) => (
                <option key={status} value={status} disabled={status === "follow_up" && !item.contactAllowed}>{t(`status.${status}`)}</option>
              ))}
            </select>
          </Field>
          {assignees ? (
            <Field label={t("assigned")}>
              <select name="assigneeId" defaultValue={item.assigneeId ?? ""} className="ui-input">
                <option value="">{t("unassigned")}</option>
                {item.assigneeId && !assignees.some(({ _id }) => _id === item.assigneeId) ? <option value={item.assigneeId} disabled>{t("inactive")}</option> : null}
                {assignees.map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}
              </select>
            </Field>
          ) : null}
          {status === "follow_up" ? <Field label={t("dueDate")}><input name="dueDate" type="date" defaultValue={item.dueDate ?? ""} className="ui-input" /></Field> : null}
        </div>
        <details>
          <summary className="cursor-pointer py-2 text-sm font-medium">{t("addNote")}</summary>
          <Field label={t("noteLabel")} hint={t("noteHint")}>
            <textarea name="note" rows={3} maxLength={2000} value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} className="ui-input" />
          </Field>
        </details>
        <Button type="submit" disabled={saving}>{t("save")}</Button>
      </form>
      <section className="border-t border-black/10 pt-3">
        <button type="button" className="min-h-11 text-sm font-medium underline" aria-expanded={timelineState !== "closed"}
          onClick={() => timelineState === "closed" ? void loadTimeline() : setTimelineState("closed")} disabled={timelineState === "loading"}>
          {t(timelineState === "closed" ? "showTimeline" : "hideTimeline")}
        </button>
        {timelineState === "loading" ? <p role="status" className="text-sm">{t("loadingTimeline")}</p> : null}
        {timelineState === "error" ? <p role="alert" className="text-sm">{t("timelineFailed")} <button type="button" className="underline" onClick={() => void loadTimeline()}>{t("retryTimeline")}</button></p> : null}
        {timelineState === "open" && timeline ? (
          <ol className="space-y-4 border-l border-black/10 pl-4 text-sm">
            {timeline.events.map((entry, index) => (
              <li key={`${entry.at}:${index}`} className="space-y-1">
                <p className="font-medium">{entry.actor} <time className="font-normal text-neutral-600" dateTime={entry.at}>{new Date(entry.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time></p>
                {entry.status ? <p>{t("statusChanged", { status: t(`status.${entry.status}`) })}</p> : null}
                {entry.assignee !== undefined ? <p>{entry.assignee ? t("assignedTo", { name: entry.assignee }) : t("assignmentCleared")}</p> : null}
                {entry.dueDate !== undefined ? <p>{entry.dueDate ? t("dueOn", { date: dateLabel(entry.dueDate) }) : t("dueCleared")}</p> : null}
                {entry.note ? <p className="whitespace-pre-wrap break-words rounded-lg bg-white p-3">{entry.note}</p> : null}
              </li>
            ))}
            <li>{t("received")}{timeline.receivedAt ? ` · ${dateLabel(timeline.receivedAt)}` : ""}</li>
          </ol>
        ) : null}
      </section>
    </Card>
  );
}
