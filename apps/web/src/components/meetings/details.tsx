"use client";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, API_URL } from "@/lib/api";
import { Button, Card, CardHeader, buttonClass } from "@/components/ui/ui";
import {
  meetingName,
  type Meeting,
  type MeetingOptions,
  type MeetingAction,
} from "@/lib/meetings";

const subscribeToTimeZone = () => () => {};
const clientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";
function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
function AttendanceList({
  meeting,
  busy,
  onSave,
}: {
  meeting: Meeting;
  busy: boolean;
  onSave: (value: {
    presentUserIds: string[];
    presentMemberIds: string[];
  }) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [presentUsers, setPresentUsers] = useState(
    () => new Set(meeting.presentUserIds),
  );
  const [presentMembers, setPresentMembers] = useState(
    () => new Set(meeting.presentMemberIds),
  );
  const rows = [
    ...meeting.attendeeUserIds.map((id) => ({
      id,
      kind: "Staff",
      name: meetingName(meeting.attendeeUsers.find((p) => p._id === id)),
    })),
    ...meeting.attendeeMembers.map((p) => ({
      id: p._id,
      kind: "Member",
      name: meetingName(p),
    })),
  ];
  const filtered = rows.filter((row) =>
    row.name.toLowerCase().includes(query.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="ui-input max-w-sm"
          aria-label="Search meeting attendees"
          placeholder="Search attendees…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <p className="text-sm text-[#6b6b6b]">
          {presentUsers.size + presentMembers.size} of {rows.length} records
          present
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="ui-table w-full">
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Type</th>
              <th>Present</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.name}</td>
                <td className="text-[#8a8780]">{row.kind}</td>
                <td>
                  <input
                    aria-label={`Mark ${row.name} (${row.kind}) present`}
                    type="checkbox"
                    disabled={!meeting.canManage || busy}
                    checked={(row.kind === "Staff"
                      ? presentUsers
                      : presentMembers
                    ).has(row.id)}
                    onChange={(e) => {
                      const setter =
                        row.kind === "Staff"
                          ? setPresentUsers
                          : setPresentMembers;
                      setter((previous) => {
                        const next = new Set(previous);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="py-6 text-sm text-[#8a8780]">No matching attendees.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8a8780]">
          Page {currentPage} of {totalPages} · {filtered.length} records
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
          {meeting.canManage && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                onSave({
                  presentUserIds: [...presentUsers],
                  presentMemberIds: [...presentMembers],
                })
              }
            >
              Save attendance
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-[#8a8780]">
        Staff and member records are listed separately. Meeting attendance does
        not affect church service attendance.
      </p>
    </div>
  );
}
export function MeetingDetails({
  initial,
  options,
}: {
  initial: Meeting;
  options: MeetingOptions;
}) {
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    clientTimeZone,
    serverTimeZone,
  );
  const stamp = (value: string) => formatTime(value, timeZone);
  const [tab, setTab] = useState<"overview" | "people" | "minutes" | "actions">(
    "overview",
  );
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
    <div className="mx-auto w-full max-w-6xl space-y-5">
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
      <section className="rounded-2xl border border-black/[0.08] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8a8780]">
                {meeting.group.name}
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${meeting.status === "completed" ? "bg-emerald-50 text-emerald-700" : meeting.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}
              >
                {meeting.status === "ongoing"
                  ? "In progress"
                  : meeting.status.charAt(0).toUpperCase() +
                    meeting.status.slice(1)}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {meeting.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {meeting.canManage && meeting.status === "scheduled" && (
              <Button
                disabled={busy}
                onClick={() => void save("details", { status: "ongoing" })}
              >
                Start meeting
              </Button>
            )}
            {meeting.canManage && meeting.status === "ongoing" && (
              <Button
                disabled={busy}
                onClick={() => void save("details", { status: "completed" })}
              >
                Complete meeting
              </Button>
            )}
            {meeting.canManage && (
              <Link
                href={`/meetings/${meeting._id}/edit`}
                className={buttonClass("secondary", "sm")}
              >
                Edit
              </Link>
            )}
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-black/10 px-3 py-2 text-sm">
                More ▾
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={downloadCalendar}
                >
                  Add to calendar
                </Button>
                {meeting.canManage && meeting.status !== "scheduled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    disabled={busy}
                    onClick={() =>
                      void save("details", { status: "scheduled" })
                    }
                  >
                    Reopen as scheduled
                  </Button>
                )}
                {meeting.canManage && meeting.status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-700"
                    disabled={busy}
                    onClick={() =>
                      void save("details", { status: "cancelled" })
                    }
                  >
                    Cancel meeting
                  </Button>
                )}
              </div>
            </details>
          </div>
        </div>
        <div className="mt-6 grid gap-5 border-t border-black/5 pt-5 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">
              When · {timeZone.replaceAll("_", " ")}
            </p>
            <p className="text-sm font-medium">{stamp(meeting.startsAt)}</p>
            <p className="text-sm text-[#6b6b6b]">to {stamp(meeting.endsAt)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">Where</p>
            <p className="text-sm font-medium">
              {meeting.location ||
                (meeting.joinUrl ? "Online" : "To be confirmed")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">Organiser</p>
            <p className="text-sm font-medium">
              {person(meeting.organizerUserId)}
            </p>
          </div>
        </div>
      </section>
      <nav
        aria-label="Meeting sections"
        className="flex gap-1 overflow-x-auto border-b border-black/10"
      >
        {(["overview", "people", "minutes", "actions"] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setTab(value)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${tab === value ? "border-[#111] font-semibold text-[#111]" : "border-transparent text-[#6b6b6b] hover:text-[#111]"}`}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
              {value === "people"
                ? ` (${meeting.attendeeMemberIds.length + meeting.attendeeUserIds.length})`
                : value === "actions"
                  ? ` (${meeting.actions.filter((a) => a.status === "open").length})`
                  : ""}
            </button>
          ),
        )}
      </nav>
      <div hidden={tab !== "overview"} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <h2 className="text-base font-semibold">Agenda</h2>
            <p
              className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${meeting.agenda ? "text-[#3f3d39]" : "text-[#8a8780]"}`}
            >
              {meeting.agenda || "The organiser hasn’t added an agenda yet."}
            </p>
          </section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <h2 className="text-base font-semibold">At a glance</h2>
            <dl className="mt-3 divide-y divide-black/5 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">Attendance</dt>
                <dd>
                  {meeting.presentMemberIds.length +
                    meeting.presentUserIds.length}{" "}
                  marked present
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">Minutes</dt>
                <dd className={meeting.minutesOverdue ? "text-red-700" : ""}>
                  {meeting.minutesOverdue
                    ? "Overdue"
                    : meeting.minutesStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">Open actions</dt>
                <dd>
                  {meeting.actions.filter((a) => a.status === "open").length}
                </dd>
              </div>
            </dl>
          </section>
        </div>
        {meeting.canManage && meeting.invitationSummary && (
          <section className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Invitations</h2>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void refreshInvitations()}
              >
                Refresh
              </Button>
            </div>
            {meeting.invitationSummary.requested ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  {[
                    ["Email addresses", meeting.invitationSummary.uniqueEmails],
                    [
                      "Sent to provider",
                      meeting.invitationSummary.counts.sent || 0,
                    ],
                    [
                      "Pending",
                      (meeting.invitationSummary.counts.queued || 0) +
                        (meeting.invitationSummary.counts.sending || 0),
                    ],
                  ].map(([label, count]) => (
                    <div key={label}>
                      <p className="text-2xl font-semibold tracking-tight">
                        {count}
                      </p>
                      <p className="mt-1 text-xs text-[#8a8780]">{label}</p>
                    </div>
                  ))}
                </div>
                {!meeting.invitationSummary.prepared && (
                  <p className="mt-4 text-xs text-[#8a8780]">
                    Preparing invitations…
                  </p>
                )}
                {meeting.invitationSummary.missingEmail > 0 && (
                  <p className="mt-4 text-sm text-amber-800">
                    {meeting.invitationSummary.missingEmail} records have no
                    valid email.
                  </p>
                )}
                {((meeting.invitationSummary.counts.failed || 0) > 0 ||
                  (meeting.invitationSummary.counts.uncertain || 0) > 0) && (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer text-amber-800">
                      Some invitations need attention
                    </summary>
                    <div className="mt-3 space-y-3">
                      {(meeting.invitationSummary.counts.failed || 0) > 0 && (
                        <>
                          <p>
                            {meeting.invitationSummary.counts.failed} emails
                            could not be sent. Check email configuration before
                            retrying.
                          </p>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void refreshInvitations(true)}
                          >
                            Retry unsent
                          </Button>
                        </>
                      )}
                      {(meeting.invitationSummary.counts.uncertain || 0) >
                        0 && (
                        <p>
                          {meeting.invitationSummary.counts.uncertain} attempts
                          are unconfirmed. Check the mail provider before
                          resending.
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-[#8a8780]">
                Email invitations are off.
              </p>
            )}
          </section>
        )}
      </div>
      <div hidden={tab !== "people"}>
        <Card className="!bg-white border border-black/[0.07] p-5 sm:p-6 space-y-4">
          <CardHeader
            title="Meeting attendance"
            description="Search attendees and mark who was present."
          />
          <AttendanceList
            key={JSON.stringify([
              meeting.presentUserIds,
              meeting.presentMemberIds,
            ])}
            meeting={meeting}
            busy={busy}
            onSave={(value) => void save("attendance", value)}
          />
        </Card>
      </div>
      <div hidden={tab !== "minutes"} className="space-y-5">
        <Card className="!bg-white border border-black/[0.07] p-5 sm:p-6 space-y-4">
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
            <form
              onSubmit={upload}
              className="flex flex-wrap items-center gap-3"
            >
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
                <textarea
                  name="comment"
                  className="ui-input"
                  maxLength={2000}
                />
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
        <Card className="!bg-white border border-black/[0.07] p-5 sm:p-6 space-y-4">
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
      <div hidden={tab !== "actions"}>
        <Card className="!bg-white border border-black/[0.07] p-5 sm:p-6 space-y-4">
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
      </div>
    </div>
  );
}
