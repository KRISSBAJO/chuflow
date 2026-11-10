"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { Button, Field } from "@/components/ui/ui";
import { useYouthAction } from "./use-youth-action";

type Chat = {
  enabled: boolean;
  screenedLeader: boolean;
  people: { _id: string; firstName: string; lastName: string; needsGuardian: boolean; youthChatConsentAt?: string }[];
  messages: {
    _id: string; authorName: string; body: string; createdAt: string; state: "pending" | "approved" | "hidden";
    reportCount: number; reviewHistory?: { at: string; action: "approve" | "hide" }[];
  }[];
};

export function GroupChat({ path }: { path: string }) {
  const t = useTranslations("youth.chat");
  const format = useFormatter();
  const { run, busy } = useYouthAction();
  const [data, setData] = useState<Chat>();
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(API_URL + path, { credentials: "include", cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const chat: Chat = await response.json();
      if (signal?.aborted) return;
      setData(chat);
      setFailed(false);
    } catch {
      if (!signal?.aborted) {
        setData(undefined);
        setFailed(true);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const person = data?.people.find(item => item._id === selected);
  async function save(suffix: string, method: "POST" | "PATCH", body: object) {
    if (!await run(path + suffix, method, body)) return false;
    setLoading(true);
    await load();
    return true;
  }

  return <section className="space-y-4">
    <div className="app-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t("heading")}</h2>
        <Button type="button" size="sm" variant="secondary" disabled={loading || busy} onClick={() => { setLoading(true); void load(); }}>{t("refresh")}</Button>
      </div>
      <p className="text-sm text-[var(--muted)]">{t("help")}</p>
      {failed ? <p role="alert">{t("loadError")}</p> : null}
      {loading ? <p role="status">{t("loading")}</p> : null}
      {data ? <>
        <Button type="button" size="sm" disabled={busy || loading || (!data.enabled && !data.screenedLeader)}
          onClick={() => void save("/settings", "PATCH", { enabled: !data.enabled })}>{t(data.enabled ? "pause" : "enable")}</Button>
        {!data.screenedLeader ? <p className="text-sm">{t("screening")}</p> : null}
        <Field label={t("participant")}>
          <select className="ui-input" value={selected} onChange={event => setSelected(event.target.value)}>
            <option value="">{t("choose")}</option>
            {data.people.map(item => <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>)}
          </select>
        </Field>
        {person ? <Button type="button" size="sm" variant="secondary" disabled={busy || loading} onClick={() => {
          const enabled = !person.youthChatConsentAt;
          if (!enabled || window.confirm(t(person.needsGuardian ? "confirmGuardian" : "confirmParticipant"))) {
            void save("/consent/" + person._id, "PATCH", { enabled });
          }
        }}>{t(person.youthChatConsentAt ? "revoke" : "record")}</Button> : null}
        {data.enabled && data.screenedLeader ? <form className="space-y-3" onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = String(new FormData(form).get("body") ?? "").trim();
          if (body && await save("/messages", "POST", { body })) form.reset();
        }}>
          <Field label={t("message")}><textarea name="body" className="ui-input" required maxLength={800} rows={3} /></Field>
          <Button size="sm" type="submit" disabled={busy || loading}>{t("publish")}</Button>
        </form> : null}
      </> : null}
    </div>
    {data ? <h3 className="font-semibold">{t("reviewQueue")}</h3> : null}
    {data && !data.messages.length ? <p>{t("empty")}</p> : null}
    {data?.messages.map(message => <article className="app-card space-y-2 p-5" key={message._id}>
      <p className="text-sm font-medium">{message.authorName} · {t(message.state)} · {format.dateTime(new Date(message.createdAt), { dateStyle: "medium", timeStyle: "short" })}</p>
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
      {message.reportCount ? <p role="status" className="text-sm font-medium">{t("reports", { count: message.reportCount })}</p> : null}
      {message.reviewHistory?.map(entry => <p className="text-sm" key={entry.at + entry.action}>
        {t(entry.action === "approve" ? "approved" : "hidden")} · {format.dateTime(new Date(entry.at), { dateStyle: "medium", timeStyle: "short" })}
      </p>)}
      <div className="flex flex-wrap gap-2">
        {message.state === "pending" && data.enabled && data.screenedLeader ? <Button type="button" size="sm" disabled={busy || loading}
          onClick={() => void save("/messages/" + message._id, "PATCH", { action: "approve" })}>{t("approve")}</Button> : null}
        {message.state !== "hidden" ? <Button type="button" size="sm" variant="secondary" disabled={busy || loading}
          onClick={() => void save("/messages/" + message._id, "PATCH", { action: "hide" })}>{t("hide")}</Button> : null}
      </div>
    </article>)}
  </section>;
}
