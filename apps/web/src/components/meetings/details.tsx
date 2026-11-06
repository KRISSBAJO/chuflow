"use client";
import { toast } from "sonner";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
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
type MeetingStatusKey = Parameters<
  ReturnType<typeof useTranslations<"services.meetings.statuses">>
>[0];
type MinutesStatusKey = Parameters<
  ReturnType<typeof useTranslations<"services.meetings.minutesStatuses">>
>[0];
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
  const t = useTranslations("services.meetings.details.attendance");
  const tMeetings = useTranslations("services.meetings");
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
      kind: "Staff" as const,
      name: meetingName(
        meeting.attendeeUsers.find((p) => p._id === id),
        tMeetings("userUnavailable"),
      ),
    })),
    ...meeting.attendeeMembers.map((p) => ({
      id: p._id,
      kind: "Member" as const,
      name: meetingName(p, tMeetings("userUnavailable")),
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
          aria-label={t("searchAria")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <p className="text-sm text-[#6b6b6b]">
          {t("presentCount", {
            present: presentUsers.size + presentMembers.size,
            total: rows.length,
          })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="ui-table w-full">
          <thead>
            <tr>
              <th>{t("attendee")}</th>
              <th>{t("type")}</th>
              <th>{t("present")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{row.name}</td>
                <td className="text-[#8a8780]">
                  {row.kind === "Staff" ? t("staff") : t("member")}
                </td>
                <td>
                  <input
                    aria-label={t("markPresentAria", {
                      name: row.name,
                      kind: row.kind === "Staff" ? t("staff") : t("member"),
                    })}
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
          <p className="py-6 text-sm text-[#8a8780]">{t("noMatching")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8a8780]">
          {t("pageInfo", {
            page: currentPage,
            total: totalPages,
            count: filtered.length,
          })}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("previous")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("next")}
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
              {t("save")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-[#8a8780]">{t("note")}</p>
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
  const t = useTranslations("services.meetings.details");
  const tMeetings = useTranslations("services.meetings");
  const tStatus = useTranslations("services.meetings.statuses");
  const tMinutes = useTranslations("services.meetings.minutesStatuses");
  const format = useFormatter();
  const stamp = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    });
  const statusLabel = (value: string) =>
    tStatus.has(value as MeetingStatusKey)
      ? tStatus(value as MeetingStatusKey)
      : value.charAt(0).toUpperCase() + value.slice(1);
  const minutesLabel = (value: string) =>
    tMinutes.has(value as MinutesStatusKey)
      ? tMinutes(value as MinutesStatusKey)
      : value.replaceAll("_", " ");
  const [tab, setTab] = useState<"overview" | "people" | "minutes" | "actions">(
    "overview",
  );
  const router = useRouter();
  const minutesFormRef = useRef<HTMLFormElement>(null);
  const [meeting, setMeeting] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const people = [...meeting.attendeeUsers, ...options.users];
  const person = (id: string) =>
    meetingName(
      people.find((p) => p._id === id),
      tMeetings("userUnavailable"),
    );
  async function save(operation: string, data: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const updated = await apiPatch<Meeting>(`/meetings/${meeting._id}`, {
        operation,
        expectedRevision: meeting.revision,
        ...data,
      });
      setMeeting(updated);
      toast.success(t("saved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveFailed"));
      setError(e instanceof Error ? e.message : t("saveFailed"));
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
      if (retry) toast.success(t("retryQueued"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("refreshFailed"));
      setError(e instanceof Error ? e.message : t("refreshFailed"));
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
            : body.message || t("uploadFailed"),
        );
      }
      setMeeting(await response.json());
      form.reset();
      toast.success(t("uploaded"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("uploadError"));
      setError(e instanceof Error ? e.message : t("uploadError"));
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
        throw new Error(body.message || t("removeFailed"));
      }
      setMeeting(await response.json());
      toast.success(t("removed"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("removeFailed"));
      setError(e instanceof Error ? e.message : t("removeFailed"));
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
            {t("reloadLatest")}
          </Button>
        </div>
      )}

      <section className="rounded-2xl border border-transparent bg-[#f4f3f0] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="lp-label !text-[11px] uppercase tracking-wider">
                {meeting.group.name}
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${meeting.status === "completed" ? "bg-emerald-50 text-emerald-700" : meeting.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}
              >
                {statusLabel(meeting.status)}
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
                {t("join")}
              </a>
            )}
            {meeting.canManage && meeting.status === "scheduled" && (
              <Button
                disabled={busy}
                onClick={() => void save("details", { status: "ongoing" })}
              >
                {t("start")}
              </Button>
            )}
            {meeting.canManage && meeting.status === "ongoing" && (
              <Button
                disabled={busy}
                onClick={() => void save("details", { status: "completed" })}
              >
                {t("complete")}
              </Button>
            )}
            {meeting.canManage && (
              <Link
                href={`/meetings/${meeting._id}/edit`}
                className={buttonClass("secondary", "sm")}
              >
                {t("edit")}
              </Link>
            )}
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-black/10 px-3 py-2 text-sm">
                {t("more")}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={downloadCalendar}
                >
                  {t("addToCalendar")}
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
                    {t("reopenScheduled")}
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
                    {t("cancel")}
                  </Button>
                )}
              </div>
            </details>
          </div>
        </div>
        <div className="mt-6 grid gap-5 border-t border-black/5 pt-5 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">
              {t("when", { timeZone: timeZone.replaceAll("_", " ") })}
            </p>
            <p className="text-sm font-medium">{stamp(meeting.startsAt)}</p>
            <p className="text-sm text-[#6b6b6b]">
              {t("to", { time: stamp(meeting.endsAt) })}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">{t("where")}</p>
            <p className="text-sm font-medium">
              {meeting.location ||
                (meeting.joinUrl ? t("online") : t("toBeConfirmed"))}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[#8a8780]">{t("organiser")}</p>
            <p className="text-sm font-medium">
              {person(meeting.organizerUserId)}
            </p>
          </div>
        </div>
      </section>
      <nav
        aria-label={t("sectionsAria")}
        className="flex gap-1 overflow-x-auto border-b border-black/10"
      >
        {(["overview", "people", "minutes", "actions"] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setTab(value)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${tab === value ? "border-[#ed7b19] font-semibold text-[#b94f0a]" : "border-transparent text-[#6b6b6b] hover:text-[#111]"}`}
            >
              {t(`tabs.${value}`)}
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
          <section className="rounded-2xl border border-transparent bg-[#f4f3f0] p-6">
            <h2 className="text-base font-semibold">{t("agenda")}</h2>
            <p
              className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${meeting.agenda ? "text-[#3f3d39]" : "text-[#8a8780]"}`}
            >
              {meeting.agenda || t("noAgenda")}
            </p>
          </section>
          <section className="rounded-2xl border border-transparent bg-[#f4f3f0] p-6">
            <h2 className="text-base font-semibold">{t("atAGlance")}</h2>
            <dl className="mt-3 divide-y divide-black/5 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">{t("attendanceLabel")}</dt>
                <dd>
                  {t("markedPresent", {
                    count:
                      meeting.presentMemberIds.length +
                      meeting.presentUserIds.length,
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">{t("minutesLabel")}</dt>
                <dd className={meeting.minutesOverdue ? "text-red-700" : ""}>
                  {meeting.minutesOverdue
                    ? tMinutes("overdue")
                    : minutesLabel(meeting.minutesStatus)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-[#6b6b6b]">{t("openActions")}</dt>
                <dd>
                  {meeting.actions.filter((a) => a.status === "open").length}
                </dd>
              </div>
            </dl>
          </section>
        </div>
        {meeting.canManage && meeting.invitationSummary && (
          <section className="rounded-2xl border border-transparent bg-[#f4f3f0] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{t("invitations")}</h2>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void refreshInvitations()}
              >
                {t("refresh")}
              </Button>
            </div>
            {meeting.invitationSummary.requested ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  {[
                    [
                      t("emailAddresses"),
                      meeting.invitationSummary.uniqueEmails,
                    ],
                    [
                      t("sentToProvider"),
                      meeting.invitationSummary.counts.sent || 0,
                    ],
                    [
                      t("pending"),
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
                    {t("preparing")}
                  </p>
                )}
                {meeting.invitationSummary.missingEmail > 0 && (
                  <p className="mt-4 text-sm text-amber-800">
                    {t("noValidEmail", {
                      count: meeting.invitationSummary.missingEmail,
                    })}
                  </p>
                )}
                {((meeting.invitationSummary.counts.failed || 0) > 0 ||
                  (meeting.invitationSummary.counts.uncertain || 0) > 0) && (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer text-amber-800">
                      {t("needAttention")}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {(meeting.invitationSummary.counts.failed || 0) > 0 && (
                        <>
                          <p>
                            {t("failedEmails", {
                              count: meeting.invitationSummary.counts.failed,
                            })}
                          </p>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void refreshInvitations(true)}
                          >
                            {t("retryUnsent")}
                          </Button>
                        </>
                      )}
                      {(meeting.invitationSummary.counts.uncertain || 0) >
                        0 && (
                        <p>
                          {t("uncertain", {
                            count: meeting.invitationSummary.counts.uncertain,
                          })}
                        </p>
                      )}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-[#8a8780]">
                {t("invitationsOff")}
              </p>
            )}
          </section>
        )}
      </div>
      <div hidden={tab !== "people"}>
        <Card className="p-5 sm:p-6 space-y-4">
          <CardHeader
            title={t("peopleTitle")}
            description={t("peopleDescription")}
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
        <Card className="p-5 sm:p-6 space-y-4">
          <CardHeader
            title={t("minutesTitle")}
            description={t("minutesDue", {
              requirement: meeting.minutesRequired
                ? t("minutesRequired")
                : t("minutesOptional"),
              date: stamp(meeting.minutesDueAt),
            })}
          />
          <p
            className={
              meeting.minutesOverdue ? "font-medium text-red-700" : "text-sm"
            }
          >
            {meeting.minutesOverdue ? t("overduePrefix") : ""}
            {t("status", { status: minutesLabel(meeting.minutesStatus) })}
          </p>
          {meeting.reviewComment && (
            <p className="rounded-xl bg-white p-3">
              {t("reviewer", { comment: meeting.reviewComment })}
            </p>
          )}
          <form
            key={`minutes-${JSON.stringify([meeting.minutesBody, meeting.minutesLinks])}`}
            ref={minutesFormRef}
            onSubmit={minutesSubmit}
            className="space-y-4"
          >
            <label className="block space-y-2">
              <span>{t("bodyLabel")}</span>
              <textarea
                name="body"
                className="ui-input min-h-56"
                maxLength={50000}
                defaultValue={meeting.minutesBody}
                readOnly={!editableMinutes}
                placeholder={t("bodyPlaceholder")}
              />
            </label>
            <label className="block space-y-2">
              <span>{t("linksLabel")}</span>
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
                {t("saveDraft")}
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
              {t("openLink", { n: i + 1 })}
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
                  {t("fileSize", {
                    name: file.name,
                    size: Math.ceil(file.size / 1024),
                  })}
                </a>
                {editableMinutes && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void removeFile(file._id)}
                  >
                    {t("remove")}
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
                aria-label={t("attachAria")}
                name="file"
                type="file"
                required
                accept=".pdf,.docx,.txt"
              />
              <Button type="submit" variant="secondary" disabled={busy}>
                {t("upload")}
              </Button>
              <p className="w-full text-sm text-[#6b6b6b]">{t("uploadHint")}</p>
            </form>
          )}
          {editableMinutes && (
            <div className="space-y-2">
              <p className="text-sm">{t("submitNote")}</p>
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
                {t("submit")}
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
                {t("reviewNotes")}
                <textarea
                  name="comment"
                  className="ui-input"
                  maxLength={2000}
                />
              </label>
              <div className="flex gap-2">
                <Button type="submit" value="approve" disabled={busy}>
                  {t("approve")}
                </Button>
                <Button
                  type="submit"
                  value="return"
                  variant="secondary"
                  disabled={busy}
                >
                  {t("requestChanges")}
                </Button>
              </div>
            </form>
          )}
        </Card>
        <Card className="p-5 sm:p-6 space-y-4">
          <CardHeader
            title={t("historyTitle")}
            description={t("historyDescription")}
          />
          {[...meeting.minutesHistory].reverse().map((h) => (
            <details key={h.revision} className="rounded-xl bg-white p-4">
              <summary>
                {t("revision", {
                  revision: h.revision,
                  status: minutesLabel(h.status),
                  date: stamp(h.at),
                  by: person(h.by),
                })}
              </summary>
              <p className="mt-3 whitespace-pre-wrap">
                {h.body || t("linksOnly")}
              </p>
              {h.links.map((url, i) => (
                <a
                  className="block underline"
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("historyLink", { n: i + 1 })}
                </a>
              ))}
              {h.comment && <p>{h.comment}</p>}
            </details>
          ))}
        </Card>
      </div>
      <div hidden={tab !== "actions"}>
        <Card className="p-5 sm:p-6 space-y-4">
          <CardHeader
            title={t("actionsTitle")}
            description={t("actionsDescription")}
          />
          {meeting.actions.length === 0 && <p>{t("noActions")}</p>}
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
                  {a.dueAt ? t("actionDue", { date: stamp(a.dueAt) }) : ""}
                  {a.status === "open" &&
                  a.dueAt &&
                  new Date(a.dueAt) < new Date()
                    ? t("actionOverdue")
                    : ""}
                </p>
              </div>
              {meeting.canManage && (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="ui-input"
                    aria-label={t("reassignAria", { title: a.title })}
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
                    {t("removeAction")}
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
                  {a.status === "done" ? t("reopen") : t("markDone")}
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
                placeholder={t("actionPlaceholder")}
                aria-label={t("actionTitleAria")}
                required
                maxLength={500}
              />
              <select
                className="ui-input"
                name="owner"
                aria-label={t("actionOwnerAria")}
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
                aria-label={t("actionDueAria")}
                type="datetime-local"
              />
              <Button
                type="submit"
                disabled={busy || meeting.actions.length >= 100}
              >
                {t("addAction")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
