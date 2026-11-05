"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, API_URL } from "@/lib/api";
import { Button, Card, CardHeader, buttonClass } from "@/components/ui/ui";
import {
  meetingName,
  type Meeting,
  type MeetingOptions,
  type MeetingAction,
} from "@/lib/meetings";

function stamp(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
}
export function MeetingDetails({
  initial,
  options,
}: {
  initial: Meeting;
  options: MeetingOptions;
}) {
  const router = useRouter();
  const minutesFormRef = useRef<HTMLFormElement>(null);
  const [meeting, setMeeting] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const people = [...meeting.attendeeUsers, ...options.users];
  const person = (id: string) => meetingName(people.find((p) => p._id === id));
  async function save(operation: string, data: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiPatch<Meeting>(`/meetings/${meeting._id}`, {
        operation,
        expectedRevision: meeting.revision,
        ...data,
      });
      setMeeting(updated);
      setNotice("Saved successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function refreshInvitations(retry = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = retry
        ? await apiPost<Meeting>(
            `/meetings/${meeting._id}/invitations/retry`,
            {},
          )
        : await apiGet<Meeting>(`/meetings/${meeting._id}`);
      setMeeting(updated);
      if (retry)
        setNotice(
          "Failed invitations queued for retry. Already-sent invitations will not be resent.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh invitations",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/meetings/${meeting._id}/files`, {
        method: "POST",
        credentials: "include",
        body: data,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : body.message || "Upload failed",
        );
      }
      setMeeting(await response.json());
      form.reset();
      setNotice("Document uploaded.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function removeFile(fileId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/meetings/${meeting._id}/files/${fileId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedRevision: meeting.revision }),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Could not remove document");
      }
      setMeeting(await response.json());
      setNotice("Document removed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove document");
    } finally {
      setBusy(false);
    }
  }
  function downloadCalendar() {
    const clean = (v: string) =>
      v
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;")
        .replace(/\r/g, "");
    const date = (v: string) =>
      new Date(v)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ChuFlow//Meetings//EN",
      "BEGIN:VEVENT",
      `UID:${meeting._id}@chuflow.com`,
      `DTSTAMP:${date(new Date().toISOString())}`,
      `DTSTART:${date(meeting.startsAt)}`,
      `DTEND:${date(meeting.endsAt)}`,
      `SUMMARY:${clean(meeting.title)}`,
      `DESCRIPTION:${clean([meeting.agenda, meeting.joinUrl].filter(Boolean).join("\n"))}`,
      `LOCATION:${clean(meeting.location)}`,
      `STATUS:${meeting.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "meeting.ics";
    a.click();
    URL.revokeObjectURL(url);
  }
  const editableMinutes =
    meeting.canManage &&
    ["draft", "changes_requested"].includes(meeting.minutesStatus);
  function minutesSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void save("minutes", {
      minutesBody: d.get("body"),
      minutesLinks: String(d.get("links") || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  }
  function addAction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const next: MeetingAction = {
      id: crypto.randomUUID(),
      title: String(d.get("title")),
      ownerUserId: String(d.get("owner")),
      status: "open",
      ...(d.get("due")
        ? { dueAt: new Date(String(d.get("due"))).toISOString() }
        : {}),
    };
    void save("actions", { actions: [...meeting.actions, next] });
  }
  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}{" "}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Reload latest
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
      <Card className="p-6 space-y-4">
        <CardHeader
          title={meeting.title}
          label={meeting.group.name}
          description={`${stamp(meeting.startsAt)} – ${stamp(meeting.endsAt)}`}
          action={
            <>
              {meeting.canManage && (
                <Link
                  href={`/meetings/${meeting._id}/edit`}
                  className={buttonClass("secondary")}
                >
                  Edit meeting
                </Link>
              )}
              <Button variant="secondary" onClick={downloadCalendar}>
                Add to calendar
              </Button>
              {meeting.joinUrl && meeting.status !== "cancelled" && (
                <a
                  href={meeting.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass()}
                >
                  Join meeting ↗
                </a>
              )}
            </>
          }
        />
        <p>{meeting.location || "Online / location not specified"}</p>
        <p className="whitespace-pre-wrap">
          {meeting.agenda || "No agenda added."}
        </p>
        <p className="text-sm">
          Organiser: {person(meeting.organizerUserId)} · Status:{" "}
          {meeting.status}
        </p>
        {meeting.canManage && (
          <div className="flex flex-wrap gap-2">
            {["scheduled", "ongoing", "completed", "cancelled"].map(
              (status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={meeting.status === status ? "primary" : "secondary"}
                  disabled={busy || meeting.status === status}
                  onClick={() => void save("details", { status })}
                >
                  {status === "ongoing"
                    ? "Start meeting"
                    : status === "completed"
                      ? "Mark completed"
                      : status === "cancelled"
                        ? "Cancel meeting"
                        : "Scheduled"}
                </Button>
              ),
            )}
          </div>
        )}
      </Card>
      {meeting.canManage && meeting.invitationSummary && (
        <Card className="p-6 space-y-3">
          <CardHeader
            title="Email invitations"
            description="Each unique email address receives one invitation per meeting, including people in several selected groups."
          />
          {meeting.invitationSummary.requested ? (
            <>
              <p>
                {meeting.invitationSummary.uniqueEmails} unique email addresses
                · {meeting.invitationSummary.counts.sent || 0} accepted by the
                email provider · {meeting.invitationSummary.counts.queued || 0}{" "}
                queued · {meeting.invitationSummary.counts.sending || 0} sending
              </p>
              {!meeting.invitationSummary.prepared && (
                <p className="text-sm">
                  Preparing invitations. Refresh shortly to see progress.
                </p>
              )}
              {meeting.invitationSummary.missingEmail > 0 && (
                <p className="text-amber-800">
                  {meeting.invitationSummary.missingEmail} selected records have
                  no valid email address.
                </p>
              )}
              {(meeting.invitationSummary.counts.failed || 0) > 0 && (
                <p className="text-red-700">
                  {meeting.invitationSummary.counts.failed} invitations were not
                  sent because email delivery is not configured. Configure the
                  mail provider, then retry.
                </p>
              )}
              {(meeting.invitationSummary.counts.uncertain || 0) > 0 && (
                <p className="text-amber-800">
                  {meeting.invitationSummary.counts.uncertain} attempts could
                  not be confirmed. Check the mail provider before sending
                  again; they are not automatically retried to avoid duplicate
                  emails.
                </p>
              )}
            </>
          ) : (
            <p>Email invitations are off. Edit the meeting to enable them.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void refreshInvitations()}
            >
              Refresh invitation status
            </Button>
            {meeting.invitationSummary.requested &&
              (meeting.invitationSummary.counts.failed || 0) > 0 && (
                <Button
                  disabled={busy}
                  onClick={() => void refreshInvitations(true)}
                >
                  Retry unsent invitations
                </Button>
              )}
          </div>
        </Card>
      )}
      <Card className="p-6 space-y-4">
        <CardHeader
          title="Meeting attendance"
          description="Record who attended this meeting. This does not create church service attendance."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void save("attendance", {
              presentUserIds: d.getAll("presentUsers"),
              presentMemberIds: d.getAll("presentMembers"),
            });
          }}
          key={`attendance-${JSON.stringify([meeting.presentUserIds, meeting.presentMemberIds])}`}
          className="space-y-4"
        >
          <p className="text-sm">
            {meeting.presentUserIds.length} of {meeting.attendeeUserIds.length}{" "}
            staff users · {meeting.presentMemberIds.length} of{" "}
            {meeting.attendeeMemberIds.length} member records marked present. A
            person listed in both remains two entries.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="font-medium mb-2">Staff users</legend>
              {meeting.attendeeUserIds.map((id) => (
                <label className="flex gap-2" key={id}>
                  <input
                    name="presentUsers"
                    type="checkbox"
                    value={id}
                    defaultChecked={meeting.presentUserIds.includes(id)}
                    disabled={!meeting.canManage}
                  />
                  {person(id)}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="font-medium mb-2">Members</legend>
              {meeting.attendeeMembers.map((p) => (
                <label className="flex gap-2" key={p._id}>
                  <input
                    name="presentMembers"
                    type="checkbox"
                    value={p._id}
                    defaultChecked={meeting.presentMemberIds.includes(p._id)}
                    disabled={!meeting.canManage}
                  />
                  {meetingName(p)}
                </label>
              ))}
            </fieldset>
          </div>
          {meeting.canManage && (
            <Button type="submit" disabled={busy}>
              Save attendance
            </Button>
          )}
        </form>
      </Card>
      <Card className="p-6 space-y-4">
        <CardHeader
          title="Minutes and documents"
          description={`${meeting.minutesRequired ? "Minutes required" : "Minutes optional"} · Due ${stamp(meeting.minutesDueAt)}`}
        />
        <p
          className={
            meeting.minutesOverdue ? "font-medium text-red-700" : "text-sm"
          }
        >
          {meeting.minutesOverdue ? "Overdue · " : ""}Status:{" "}
          {meeting.minutesStatus.replaceAll("_", " ")}
        </p>
        {meeting.reviewComment && (
          <p className="rounded-xl bg-white p-3">
            Reviewer: {meeting.reviewComment}
          </p>
        )}
        <form
          key={`minutes-${JSON.stringify([meeting.minutesBody, meeting.minutesLinks])}`}
          ref={minutesFormRef}
          onSubmit={minutesSubmit}
          className="space-y-4"
        >
          <label className="block space-y-2">
            <span>Minutes / decisions</span>
            <textarea
              name="body"
              className="ui-input min-h-56"
              maxLength={50000}
              defaultValue={meeting.minutesBody}
              readOnly={!editableMinutes}
              placeholder="Opening, matters discussed, decisions, next steps…"
            />
          </label>
          <label className="block space-y-2">
            <span>Minutes links (one URL per line, up to 10)</span>
            <textarea
              name="links"
              className="ui-input min-h-24"
              defaultValue={meeting.minutesLinks.join("\n")}
              readOnly={!editableMinutes}
              placeholder="https://docs.google.com/…"
            />
          </label>
          {editableMinutes && (
            <Button type="submit" disabled={busy}>
              Save minutes draft
            </Button>
          )}
        </form>
        {meeting.minutesLinks.map((url, i) => (
          <a
            className="block underline break-all"
            href={url}
            key={i}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open attached minutes link {i + 1} ↗
          </a>
        ))}
        <div className="space-y-2">
          {meeting.files.map((file) => (
            <div key={file._id} className="flex flex-wrap items-center gap-3">
              <a
                key={file._id}
                className="block underline"
                href={`${API_URL}/meetings/${meeting._id}/files/${file._id}`}
              >
                {file.name} · {Math.ceil(file.size / 1024)} KB ↓
              </a>
              {editableMinutes && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void removeFile(file._id)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {editableMinutes && (
          <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Attach minutes document"
              name="file"
              type="file"
              required
              accept=".pdf,.docx,.txt"
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              Upload document
            </Button>
            <p className="w-full text-sm text-[#6b6b6b]">
              PDF, DOCX or TXT · up to 5 MB each · 10 documents per meeting.
              Uploads are private to authorised meeting users.
            </p>
          </form>
        )}
        {editableMinutes && (
          <div className="space-y-2">
            <p className="text-sm">
              Submission saves your current minutes text and links, then locks
              them until a reviewer returns them.
            </p>
            <Button
              disabled={busy || meeting.status === "cancelled"}
              onClick={() => {
                const form = minutesFormRef.current;
                if (!form) return;
                const d = new FormData(form);
                void save("submit", {
                  minutesBody: d.get("body"),
                  minutesLinks: String(d.get("links") || "")
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                });
              }}
            >
              Submit minutes for review
            </Button>
          </div>
        )}
        {meeting.canReview && meeting.minutesStatus === "submitted" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const submitter = (e.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement;
              void save(submitter.value, { reviewComment: d.get("comment") });
            }}
          >
            <label className="block">
              Review notes
              <textarea name="comment" className="ui-input" maxLength={2000} />
            </label>
            <div className="flex gap-2">
              <Button type="submit" value="approve" disabled={busy}>
                Approve minutes
              </Button>
              <Button
                type="submit"
                value="return"
                variant="secondary"
                disabled={busy}
              >
                Request changes
              </Button>
            </div>
          </form>
        )}
      </Card>
      <Card className="p-6 space-y-4">
        <CardHeader
          title="Actions and follow-through"
          description="Assign an owner and deadline to each next step."
        />
        {meeting.actions.length === 0 && <p>No actions yet.</p>}
        {meeting.actions.map((a) => (
          <div
            key={a.id}
            className="rounded-xl bg-white p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className={a.status === "done" ? "line-through" : ""}>
                {a.title}
              </p>
              <p className="text-sm text-[#6b6b6b]">
                {person(a.ownerUserId)}
                {a.dueAt ? ` · Due ${stamp(a.dueAt)}` : ""}
                {a.status === "open" &&
                a.dueAt &&
                new Date(a.dueAt) < new Date()
                  ? " · Overdue"
                  : ""}
              </p>
            </div>
            {meeting.canManage && (
              <div className="flex flex-wrap gap-2">
                <select
                  className="ui-input"
                  aria-label={`Reassign ${a.title}`}
                  value={a.ownerUserId}
                  disabled={busy}
                  onChange={(e) =>
                    void save("actions", {
                      actions: meeting.actions.map((x) =>
                        x.id === a.id
                          ? { ...x, ownerUserId: e.target.value }
                          : x,
                      ),
                    })
                  }
                >
                  {[
                    ...new Set([
                      meeting.organizerUserId,
                      ...meeting.attendeeUserIds,
                    ]),
                  ].map((id) => (
                    <option key={id} value={id}>
                      {person(id)}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void save("actions", {
                      actions: meeting.actions.filter((x) => x.id !== a.id),
                    })
                  }
                >
                  Remove action
                </Button>
              </div>
            )}
            {(meeting.canManage || a.ownerUserId === options.userId) && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void save("actions", {
                    actions: meeting.actions.map((x) =>
                      x.id === a.id
                        ? {
                            ...x,
                            status: x.status === "done" ? "open" : "done",
                          }
                        : x,
                    ),
                  })
                }
              >
                {a.status === "done" ? "Reopen" : "Mark done"}
              </Button>
            )}
          </div>
        ))}
        {meeting.canManage && (
          <form
            onSubmit={addAction}
            className="grid gap-3 sm:grid-cols-2"
            key={`action-${meeting.revision}`}
          >
            <input
              className="ui-input sm:col-span-2"
              name="title"
              placeholder="Action / next step"
              aria-label="Action title"
              required
              maxLength={500}
            />
            <select
              className="ui-input"
              name="owner"
              aria-label="Action owner"
              required
            >
              {[
                ...new Set([
                  meeting.organizerUserId,
                  ...meeting.attendeeUserIds,
                ]),
              ].map((id) => (
                <option key={id} value={id}>
                  {person(id)}
                </option>
              ))}
            </select>
            <input
              className="ui-input"
              name="due"
              aria-label="Action due date"
              type="datetime-local"
            />
            <Button
              type="submit"
              disabled={busy || meeting.actions.length >= 100}
            >
              Add action
            </Button>
          </form>
        )}
      </Card>
      <Card className="p-6 space-y-4">
        <CardHeader
          title="Minutes revision history"
          description="The latest 30 saved minutes revisions and review decisions are retained."
        />
        {[...meeting.minutesHistory].reverse().map((h) => (
          <details key={h.revision} className="rounded-xl bg-white p-4">
            <summary>
              Revision {h.revision} · {h.status.replaceAll("_", " ")} ·{" "}
              {stamp(h.at)} · {person(h.by)}
            </summary>
            <p className="mt-3 whitespace-pre-wrap">
              {h.body || "Minutes supplied as links or documents."}
            </p>
            {h.links.map((url, i) => (
              <a
                className="block underline"
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Minutes link {i + 1}
              </a>
            ))}
            {h.comment && <p>{h.comment}</p>}
          </details>
        ))}
      </Card>
    </div>
  );
}
