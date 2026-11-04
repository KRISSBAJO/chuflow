"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import {
  referenceId,
  meetingName,
  type MeetingOptions,
  type MeetingGroup,
  type MeetingPerson,
  type Meeting,
} from "@/lib/meetings";

export function MemberPicker({
  branchId,
  selected,
  onChange,
}: {
  branchId: string;
  selected: MeetingPerson[];
  onChange: (people: MeetingPerson[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MeetingPerson[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function search(nextPage = 1) {
    if (!branchId) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiGet<{ items: MeetingPerson[]; total: number }>(
        `/meetings/participants?branchId=${encodeURIComponent(branchId)}&q=${encodeURIComponent(query)}&page=${nextPage}`,
      );
      setItems(result.items);
      setTotal(result.total);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find members");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="ui-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name"
          aria-label="Search members"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button
          variant="secondary"
          disabled={busy || !branchId}
          onClick={() => void search()}
        >
          Find
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="text-sm text-[#6b6b6b]">
        {selected.length} members selected. Search to add members, including
        those without a login.
      </p>
      <div className="flex flex-wrap gap-2">
        {selected.map((p) => (
          <Button
            size="sm"
            variant="secondary"
            key={p._id}
            onClick={() => onChange(selected.filter((x) => x._id !== p._id))}
          >
            {meetingName(p)} ×
          </Button>
        ))}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-2">
        {items.map((p) => (
          <label className="flex gap-2 text-sm" key={p._id}>
            <input
              type="checkbox"
              checked={selected.some((x) => x._id === p._id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, p]
                    : selected.filter((x) => x._id !== p._id),
                )
              }
            />
            {meetingName(p)}
          </label>
        ))}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1 || busy}
            onClick={() => void search(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page * 50 >= total || busy}
            onClick={() => void search(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
export function UserChoices({
  users,
  name,
  chosen = [],
}: {
  users: MeetingPerson[];
  name: string;
  chosen?: string[];
}) {
  return (
    <div className="max-h-52 overflow-y-auto space-y-2 rounded-xl bg-white p-3">
      {users.length ? (
        users.map((u) => (
          <label key={u._id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={u._id}
              defaultChecked={chosen.includes(u._id)}
            />
            {meetingName(u)}
          </label>
        ))
      ) : (
        <p className="text-sm">No users in this branch.</p>
      )}
    </div>
  );
}
export function MeetingGroupForm({
  options,
  group,
}: {
  options: MeetingOptions;
  group?: MeetingGroup;
}) {
  const router = useRouter();
  const [branch, setBranch] = useState(
    group ? referenceId(group.branchId) : options.branches[0]?._id || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const users = options.users.filter(
    (u) => u.branchId === branch || u._id === options.userId,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = {
        branchId: branch,
        name: d.get("name"),
        ...(d.get("serviceUnitId")
          ? { serviceUnitId: d.get("serviceUnitId") }
          : {}),
        enabled: d.get("enabled") === "on",
        minutesRequired: d.get("minutesRequired") === "on",
        minutesDueHours: Number(d.get("minutesDueHours")),
        submitterUserIds: d.getAll("submitterUserIds"),
        reviewerUserIds: d.getAll("reviewerUserIds"),
        ...(group ? { expectedRevision: group.revision } : {}),
      };
      if (group) await apiPatch(`/meetings/groups/${group._id}`, payload);
      else await apiPost("/meetings/groups", payload);
      router.push("/meetings/groups");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save group");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Branch" required>
          <select
            className="ui-input"
            value={branch}
            disabled={!!group}
            onChange={(e) => setBranch(e.target.value)}
          >
            {options.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Meeting group name" required>
          <input
            className="ui-input"
            name="name"
            required
            minLength={2}
            maxLength={150}
            defaultValue={group?.name}
            placeholder="Choir, ushers, leadership council…"
          />
        </Field>
        <Field label="Related service group (optional)">
          <select
            key={branch}
            className="ui-input"
            name="serviceUnitId"
            defaultValue={group?.serviceUnitId || ""}
          >
            <option value="">Other meeting group</option>
            {options.serviceUnits
              .filter((x) => x.branchId === branch)
              .map((x) => (
                <option key={x._id} value={x._id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
        <label className="flex gap-2">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={group?.enabled ?? true}
          />
          Enable meetings for this group
        </label>
        <label className="flex gap-2">
          <input
            name="minutesRequired"
            type="checkbox"
            defaultChecked={group?.minutesRequired ?? true}
          />
          Require minutes for each new meeting
        </label>
        <Field label="Minutes due within this many hours after the meeting">
          <input
            type="number"
            className="ui-input"
            name="minutesDueHours"
            min={1}
            max={720}
            required
            defaultValue={group?.minutesDueHours || 72}
          />
        </Field>
        <p className="text-sm text-[#6b6b6b]">
          Requirements are saved with each meeting. Changes here apply to new
          meetings. Disabling a group stops new scheduling; existing meetings
          remain available.
        </p>
        <Field
          label="Submitters"
          hint="These users can schedule meetings, record attendance and submit minutes for this group."
        >
          <UserChoices
            key={`${branch}-s`}
            name="submitterUserIds"
            users={users}
            chosen={group?.submitterUserIds}
          />
        </Field>
        <Field
          label="Reviewers"
          hint="These users can approve or return submitted minutes. Branch leadership can also review."
        >
          <UserChoices
            key={`${branch}-r`}
            name="reviewerUserIds"
            users={users}
            chosen={group?.reviewerUserIds}
          />
        </Field>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !branch}>
          {busy ? "Saving…" : "Save group settings"}
        </Button>
      </form>
    </Card>
  );
}
export function MeetingForm({
  options,
  meeting,
}: {
  options: MeetingOptions;
  meeting?: Meeting;
}) {
  const router = useRouter();
  const available = options.groups.filter(
    (g) =>
      g.enabled &&
      (options.isAdmin || g.submitterUserIds.includes(options.userId)),
  );
  const [groupId, setGroupId] = useState(
    meeting ? referenceId(meeting.groupId) : available[0]?._id || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MeetingPerson[]>(
    meeting?.attendeeMembers || [],
  );
  const group = options.groups.find((g) => g._id === groupId);
  const branch = group
    ? referenceId(group.branchId)
    : meeting
      ? referenceId(meeting.branchId)
      : "";
  const users = options.users.filter(
    (u) => u.branchId === branch || u._id === options.userId,
  );
  function local(value?: string) {
    if (!value) return "";
    const d = new Date(value);
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: d.get("title"),
        agenda: d.get("agenda"),
        startsAt: new Date(String(d.get("startsAt"))).toISOString(),
        endsAt: new Date(String(d.get("endsAt"))).toISOString(),
        location: d.get("location"),
        joinUrl: d.get("joinUrl") || "",
        attendeeUserIds: d.getAll("attendeeUserIds"),
        attendeeMemberIds: members.map((m) => m._id),
      };
      const result = meeting
        ? await apiPatch<Meeting>(`/meetings/${meeting._id}`, {
            ...payload,
            operation: "details",
            expectedRevision: meeting.revision,
          })
        : await apiPost<Meeting>("/meetings", { ...payload, groupId });
      router.push(`/meetings/${result._id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meeting");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        {!meeting && (
          <Field label="Meeting group" required>
            <select
              className="ui-input"
              value={groupId}
              required
              onChange={(e) => {
                setGroupId(e.target.value);
                setMembers([]);
              }}
            >
              {available.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name} —{" "}
                  {typeof g.branchId === "object" ? g.branchId.name : ""}
                </option>
              ))}
            </select>
            {!available.length && (
              <p className="text-sm">
                An admin must enable a meeting group and assign a submitter
                first.
              </p>
            )}
          </Field>
        )}
        <Field label="Meeting title" required>
          <input
            className="ui-input"
            name="title"
            required
            minLength={2}
            maxLength={200}
            defaultValue={meeting?.title}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (your local time)" required>
            <input
              className="ui-input"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={local(meeting?.startsAt)}
            />
          </Field>
          <Field label="Ends (your local time)" required>
            <input
              className="ui-input"
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={local(meeting?.endsAt)}
            />
          </Field>
        </div>
        <Field label="Venue / location">
          <input
            className="ui-input"
            name="location"
            maxLength={300}
            defaultValue={meeting?.location}
          />
        </Field>
        <Field
          label="Meeting link"
          hint="Attach a Zoom, Google Meet, Teams, or other meeting URL."
        >
          <input
            className="ui-input"
            name="joinUrl"
            type="url"
            maxLength={2000}
            defaultValue={meeting?.joinUrl}
            placeholder="https://…"
          />
        </Field>
        <Field label="Agenda">
          <textarea
            className="ui-input min-h-36"
            name="agenda"
            maxLength={10000}
            defaultValue={meeting?.agenda}
          />
        </Field>
        <Field
          label="Staff attendees"
          hint="Selected users can open this meeting and complete their assigned actions."
        >
          <UserChoices
            key={branch}
            users={users}
            name="attendeeUserIds"
            chosen={meeting?.attendeeUserIds}
          />
        </Field>
        <Field label="Member attendees">
          <MemberPicker
            key={branch}
            branchId={branch}
            selected={members}
            onChange={setMembers}
          />
        </Field>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy || (!meeting && !available.length)}
        >
          {busy
            ? "Saving…"
            : meeting
              ? "Save meeting changes"
              : "Schedule meeting"}
        </Button>
      </form>
    </Card>
  );
}
