"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPatch, apiPost } from "@/lib/api";
import { Card, Button, Field, buttonClass } from "@/components/ui/ui";
import { CarePicker } from "./care-picker";
import {
  careId,
  careLabel,
  type CareRecord,
  type CareOptions,
  type CarePerson,
} from "@/lib/care";
const when = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " UTC"
    : "Not recorded";
const outcomes = [
  "contacted",
  "no_answer",
  "callback_requested",
  "needs_help",
  "connected",
  "declined",
  "resolved",
];
export function CareDetail({
  initial,
  options,
}: {
  initial: CareRecord;
  options: CareOptions;
}) {
  const router = useRouter();
  const [c, setCase] = useState(initial);
  const [tab, setTab] = useState("timeline");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [owner, setOwner] = useState<CarePerson[]>(
    c.people.filter(
      (p) =>
        p._id === (typeof c.ownerId === "string" ? c.ownerId : c.ownerId?._id),
    ),
  );
  const [backup, setBackup] = useState<CarePerson[]>(
    c.people.filter((p) => p._id === c.backupId),
  );
  const [receiving, setReceiving] = useState<CarePerson[]>([]);
  const [entryKind, setEntryKind] = useState("contact");
  const person = (id?: string) => {
    const p = c.people.find((x) => x._id === id);
    return p ? `${p.firstName} ${p.lastName}` : "Unassigned";
  };
  const ownerId = typeof c.ownerId === "string" ? c.ownerId : c.ownerId?._id;
  const branch = careId(c.branchId);
  async function change(operation: string, data: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiPatch<CareRecord>("/care/cases/" + c._id, {
        expectedRevision: c.revision,
        operation,
        ...data,
      });
      setCase(result);
      setNotice("Care record saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save care record");
    } finally {
      setBusy(false);
    }
  }
  async function makeLink() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiPost<{ url: string }>(
        "/care/cases/" + c._id + "/check-in-link",
        {},
      );
      setLink(result.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create check-in link",
      );
    } finally {
      setBusy(false);
    }
  }
  function note(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void change(entryKind, {
      note: d.get("note"),
      ...(entryKind === "contact"
        ? {
            outcome: d.get("outcome"),
            method: d.get("method"),
            ...(d.get("taskId") ? { taskId: d.get("taskId") } : {}),
          }
        : {}),
      visibility: d.get("visibility") || "team",
      ...(d.get("nextActionAt")
        ? {
            nextActionAt: new Date(String(d.get("nextActionAt"))).toISOString(),
          }
        : {}),
    });
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}{" "}
          <button
            className="underline"
            onClick={() => window.location.reload()}
          >
            Reload latest
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-800">
          {notice}
        </p>
      )}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="lp-label">{careLabel(c.journey)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {c.firstName} {c.lastName}
            </h1>
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {c.email || "No email recorded"}
              {c.phone ? " · " + c.phone : ""}
            </p>
          </div>
          <span
            className={`rounded-full bg-white px-3 py-1 text-sm ${c.stopContact ? "text-red-700" : "text-[#b94f0a]"}`}
          >
            {c.stopContact ? "Contact stopped" : careLabel(c.stage)}
          </span>
        </div>
        <div className="grid gap-3 border-t border-black/5 pt-4 text-sm sm:grid-cols-3">
          <p>
            <span className="block text-xs text-[#8a8780]">Care owner</span>
            {person(ownerId)}
          </p>
          <p>
            <span className="block text-xs text-[#8a8780]">
              Last personal contact
            </span>
            {when(c.lastContactAt)}
          </p>
          <p>
            <span className="block text-xs text-[#8a8780]">
              Recorded individual attendance
            </span>
            {when(c.lastAttendanceAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.guestId && (
            <Link
              href={"/guests/" + c.guestId}
              className={buttonClass("secondary", "sm")}
            >
              Guest record ↗
            </Link>
          )}
          {c.memberId && (
            <Link
              href={"/members/" + c.memberId}
              className={buttonClass("secondary", "sm")}
            >
              Member record ↗
            </Link>
          )}
          {c.canManage && !c.automationEnrolledAt && (
            <Button
              size="sm"
              disabled={busy || c.stopContact}
              onClick={() => void change("enroll")}
            >
              Start care plan
            </Button>
          )}
        </div>
      </Card>
      {c.canAccept && (
        <Card className="p-5 space-y-3">
          <p className="font-medium">
            A care handover is waiting for your acceptance.
          </p>
          <p className="text-sm text-[#6b6b6b]">
            The previous owner remains responsible until you accept.
          </p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void change("accept")}>
              Accept responsibility
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void change("decline")}
            >
              Decline
            </Button>
          </div>
        </Card>
      )}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-black/10"
        aria-label="Care sections"
      >
        {["timeline", "tasks", "connection", "preferences"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${tab === t ? "border-[#ed7b19] font-semibold text-[#b94f0a]" : "border-transparent text-[#6b6b6b]"}`}
          >
            {careLabel(t)}
            {t === "tasks"
              ? ` (${c.tasks.filter((x) => x.status === "open").length})`
              : ""}
          </button>
        ))}
      </nav>
      <div hidden={tab !== "timeline"} className="space-y-5">
        <details className="app-card p-5">
          <summary className="cursor-pointer font-medium">
            Care summary & suggested message
          </summary>
          <p className="mt-3 text-sm leading-7">{c.summary}</p>
          <p className="mt-4 text-xs text-[#8a8780]">
            Suggested wording for a personal check-in. Review it before
            contacting the person.
          </p>
          <blockquote className="mt-2 rounded-xl bg-white p-4 text-sm">
            {c.language === "es"
              ? `Hola ${c.firstName}, queríamos saber cómo está. ¿Hay algo en lo que podamos apoyarle? Puede responder cuando le resulte conveniente.`
              : `Hi ${c.firstName}, we wanted to check how you are doing. Is there anything we can support you with? Please reply whenever it is convenient.`}
          </blockquote>
        </details>
        {c.canManage && (
          <Card className="p-6">
            <form onSubmit={note} className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select
                  className="ui-input max-w-xs"
                  value={entryKind}
                  onChange={(e) => setEntryKind(e.target.value)}
                >
                  <option value="contact">
                    Record a conversation / attempt
                  </option>
                  <option value="note">Add a care note</option>
                </select>
                {c.isAdmin && (
                  <select
                    className="ui-input max-w-xs"
                    name="visibility"
                    aria-label="Note access"
                  >
                    <option value="team">Assigned care team</option>
                    <option value="pastoral">Restricted to leadership</option>
                  </select>
                )}
              </div>
              <textarea
                className="ui-input min-h-28"
                name="note"
                required
                maxLength={5000}
                placeholder="What happened, and what did you agree to do next?"
              />
              {entryKind === "contact" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Outcome">
                    <select className="ui-input" name="outcome">
                      {outcomes.map((o) => (
                        <option key={o} value={o}>
                          {careLabel(o)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Method">
                    <select className="ui-input" name="method">
                      {[
                        "phone",
                        "email",
                        "whatsapp",
                        "text",
                        "in_person",
                        "administrative",
                      ].map((m) => (
                        <option key={m} value={m}>
                          {careLabel(m)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Complete an open task">
                    <select className="ui-input" name="taskId">
                      <option value="">Conversation only</option>
                      {c.tasks
                        .filter((t) => t.status === "open")
                        .map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
              )}
              <Field label="Agreed next action (optional)">
                <input
                  type="datetime-local"
                  name="nextActionAt"
                  className="ui-input max-w-sm"
                />
              </Field>
              <p className="text-xs text-[#8a8780]">
                This records staff activity. Choosing email, text or WhatsApp
                here does not send a message.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save to timeline"}
              </Button>
            </form>
          </Card>
        )}
        <Card className="p-6">
          <h2 className="font-semibold">Activity history</h2>
          <div className="mt-4 divide-y divide-black/5">
            {c.events.map((event) => (
              <article key={event._id} className="py-4">
                <p className="text-xs text-[#8a8780]">
                  {careLabel(event.kind)} · {when(event.createdAt)}
                  {event.actorId
                    ? ` · ${event.actorId.firstName} ${event.actorId.lastName}`
                    : ""}
                  {event.visibility === "pastoral" ? " · Leadership only" : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                  {event.text}
                </p>
              </article>
            ))}
            {!c.events.length && (
              <p className="text-sm text-[#8a8780]">
                No activity recorded yet.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span>{c.eventTotal} entries</span>
            <div className="flex gap-2">
              {c.eventPage > 1 && (
                <Link
                  href={`/care/${c._id}?page=${c.eventPage - 1}`}
                  className={buttonClass("ghost", "sm")}
                >
                  Newer
                </Link>
              )}
              {c.eventPage * 20 < c.eventTotal && (
                <Link
                  href={`/care/${c._id}?page=${c.eventPage + 1}`}
                  className={buttonClass("ghost", "sm")}
                >
                  Older
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>
      <div hidden={tab !== "tasks"} className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Open commitments</h2>
          {c.tasks
            .filter((t) => t.status === "open")
            .map((t) => (
              <div className="rounded-xl bg-white p-4 space-y-2" key={t._id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{t.title}</h3>
                  <span className="text-xs text-[#8a8780]">
                    {when(t.dueAt)}
                    {t.escalated ? " · Leadership review" : ""}
                  </span>
                </div>
                {t.evidence && (
                  <p className="text-sm text-[#6b6b6b]">{t.evidence}</p>
                )}
                {(c.canManage || t.assignedTo === options.userId) && (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      void change("complete", {
                        taskId: t._id,
                        outcome: d.get("outcome"),
                        note: d.get("note") || undefined,
                      });
                    }}
                  >
                    <select className="ui-input max-w-xs" name="outcome">
                      {outcomes.map((o) => (
                        <option key={o} value={o}>
                          {careLabel(o)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="ui-input flex-1 min-w-40"
                      name="note"
                      placeholder="Outcome note (optional)"
                      maxLength={5000}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      Complete
                    </Button>
                  </form>
                )}
              </div>
            ))}
          {!c.tasks.some((t) => t.status === "open") && (
            <p className="text-sm text-[#8a8780]">No open commitments.</p>
          )}
        </Card>
        {c.canManage && (
          <Card className="p-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void change("task", {
                  title: d.get("title"),
                  nextActionAt: new Date(String(d.get("due"))).toISOString(),
                  ...(d.get("unit") ? { serviceUnitId: d.get("unit") } : {}),
                });
              }}
            >
              <h2 className="font-semibold">Add a next step</h2>
              <input
                className="ui-input"
                name="title"
                aria-label="Task title"
                required
                minLength={2}
                maxLength={200}
                placeholder="Introduce to a group, arrange a pastoral call…"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Due">
                  <input
                    className="ui-input"
                    name="due"
                    type="datetime-local"
                    required
                  />
                </Field>
                <Field label="Group introduction (optional)">
                  <select className="ui-input" name="unit">
                    <option value="">Other care action</option>
                    {c.units.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button type="submit" disabled={busy}>
                Add task
              </Button>
            </form>
          </Card>
        )}
      </div>
      <div hidden={tab !== "connection"} className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Belonging and next steps</h2>
          <div className="flex flex-wrap gap-2">
            {c.milestones.map((m) => (
              <span className="rounded-full bg-white px-3 py-1 text-sm" key={m}>
                {careLabel(m)}
              </span>
            ))}
            {!c.milestones.length && (
              <p className="text-sm text-[#8a8780]">
                Milestones appear when visits, membership and group placements
                are recorded.
              </p>
            )}
          </div>
          {c.canManage && (
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void change("journey", {
                  stage: new FormData(e.currentTarget).get("stage"),
                });
              }}
            >
              <select
                className="ui-input max-w-xs"
                name="stage"
                defaultValue={c.stage}
              >
                {["new", "connecting", "connected", "paused", "closed"].map(
                  (stage) => (
                    <option key={stage} value={stage}>
                      {careLabel(stage)}
                    </option>
                  ),
                )}
              </select>
              <Button type="submit" disabled={busy}>
                Update stage
              </Button>
            </form>
          )}
        </Card>
        {c.canManage && (
          <Card className="p-6 space-y-5">
            <h2 className="font-semibold">Ownership and handover</h2>
            {c.isAdmin && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void change("assign", {
                    userId: owner[0]?._id || null,
                    backupId: backup[0]?._id || null,
                  });
                }}
              >
                <Field label="Care owner">
                  <CarePicker
                    branchId={branch}
                    selected={owner}
                    onChange={setOwner}
                    single
                  />
                </Field>
                <Field label="Backup worker">
                  <CarePicker
                    branchId={branch}
                    selected={backup}
                    onChange={setBackup}
                    single
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  Save ownership
                </Button>
              </form>
            )}
            <form
              className="space-y-4 border-t border-black/5 pt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void change("handover", {
                  userId: receiving[0]?._id,
                  note: d.get("note"),
                });
              }}
            >
              <Field label="Request a handover">
                <CarePicker
                  branchId={branch}
                  selected={receiving}
                  onChange={setReceiving}
                  single
                />
              </Field>
              <textarea
                className="ui-input"
                name="note"
                required
                maxLength={5000}
                placeholder="What does the receiving worker need to know?"
              />
              <p className="text-xs text-[#8a8780]">
                The current owner remains responsible until the receiving worker
                accepts.
              </p>
              <Button type="submit" disabled={busy || !receiving.length}>
                Request handover
              </Button>
            </form>
            {c.handover && (
              <p className="text-sm">
                Handover: {careLabel(c.handover.status)}
              </p>
            )}
          </Card>
        )}
      </div>
      <div hidden={tab !== "preferences"} className="space-y-5">
        {c.canManage && (
          <>
            <Card className="p-6">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void change("preferences", {
                    emailAllowed: d.get("emailAllowed") === "on",
                    stopContact: d.get("stopContact") === "on",
                    language: d.get("language"),
                    note: d.get("note") || undefined,
                  });
                }}
              >
                <h2 className="font-semibold">Contact permission</h2>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="emailAllowed"
                    defaultChecked={c.emailAllowed}
                  />
                  Permission is recorded for automated care email
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="stopContact"
                    defaultChecked={c.stopContact}
                  />
                  Stop contact
                </label>
                <Field label="Preferred language">
                  <select
                    className="ui-input max-w-xs"
                    name="language"
                    defaultValue={c.language}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
                <Field label="Permission source / changes">
                  <textarea
                    className="ui-input"
                    name="note"
                    maxLength={5000}
                    placeholder="How and when did the person give or renew permission?"
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  Save preferences
                </Button>
              </form>
            </Card>
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">
                Availability and member check-in
              </h2>
              {c.stage === "paused" ? (
                <>
                  <p className="text-sm">
                    Paused until {when(c.pausedUntil)} · {c.absenceExplanation}
                  </p>
                  <Button disabled={busy} onClick={() => void change("resume")}>
                    Resume care
                  </Button>
                </>
              ) : (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    void change("pause", {
                      until: new Date(String(d.get("until"))).toISOString(),
                      note: d.get("note") || undefined,
                    });
                  }}
                >
                  <input
                    className="ui-input"
                    type="datetime-local"
                    name="until"
                    aria-label="Pause until"
                    required
                  />
                  <input
                    className="ui-input"
                    name="note"
                    aria-label="Reason for pause"
                    placeholder="Travel, work, temporary availability…"
                    maxLength={5000}
                  />
                  <Button disabled={busy} type="submit" variant="secondary">
                    Pause care
                  </Button>
                </form>
              )}
              <div className="border-t border-black/5 pt-4 space-y-3">
                <p className="text-sm text-[#6b6b6b]">
                  Create a private, time-limited link for the person to request
                  help or update their availability. Creating a link does not
                  send it.
                </p>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => void makeLink()}
                >
                  Create member check-in link
                </Button>
                {link && (
                  <div className="flex gap-2">
                    <input
                      className="ui-input"
                      aria-label="Private check-in link"
                      readOnly
                      value={link}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => setNotice("Link copied."))
                          .catch(() => setError("Could not copy link."));
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-6 space-y-3">
              <h2 className="font-semibold">Automation history</h2>
              {c.jobs.map((job) => (
                <div className="rounded-xl bg-white p-3 text-sm" key={job._id}>
                  <p>
                    {careLabel(job.kind)} · {careLabel(job.status)} ·{" "}
                    {when(job.dueAt)}
                  </p>
                  <p className="mt-1 text-xs text-[#8a8780]">{job.result}</p>
                </div>
              ))}
              {!c.jobs.length && (
                <p className="text-sm text-[#8a8780]">
                  No scheduled automation for this person.
                </p>
              )}
              {c.jobs.some((j) => j.status === "failed") && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void change("retry_messages")}
                >
                  Retry unsent care emails
                </Button>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
