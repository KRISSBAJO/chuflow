"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiPost, apiPatch } from "@/lib/api";
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
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MeetingPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listId = useId();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!branchId) return;
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/meetings/participants?branchId=${encodeURIComponent(branchId)}&q=${encodeURIComponent(query)}&page=${page}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Could not load matching members.");
        const result = (await response.json()) as {
          items: MeetingPerson[];
          total: number;
        };
        if (!controller.signal.aborted) {
          setItems(result.items);
          setTotal(result.total);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not search members.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, query, page]);
  return (
    <div className="space-y-3">
      <input
        className="ui-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Start typing a member’s name or email…"
        aria-label="Search members"
        aria-controls={listId}
        role="searchbox"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <p className="text-sm text-[#6b6b6b]">
        {selected.length} individual members selected. People already in a
        selected group are counted once.
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
      <div
        id={listId}
        aria-label="Matching members"
        aria-busy={busy}
        className="max-h-64 overflow-y-auto rounded-xl bg-white p-3 space-y-2"
      >
        {busy && (
          <p role="status" className="text-sm">
            Searching…
          </p>
        )}
        {!busy && !error && items.length === 0 && (
          <p className="text-sm">No matching members.</p>
        )}
        {items.map((p) => (
          <label
            className="flex items-start gap-2 rounded-lg px-2 py-1 text-sm"
            key={p._id}
          >
            <input
              className="mt-1"
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
            <span>
              {meetingName(p)}
              <span className="block text-xs text-[#6b6b6b]">
                {p.email || "No email recorded"}
              </span>
            </span>
          </label>
        ))}
      </div>
      {total > 50 && (
        <div className="flex items-center gap-3 text-sm">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1 || busy}
            onClick={() => setPage(page - 1)}
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
            onClick={() => setPage(page + 1)}
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
    meeting
      ? referenceId(meeting.groupId)
      : options.isAdmin
        ? "__church__"
        : available[0]?._id || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MeetingPerson[]>(
    (meeting?.attendeeMembers || []).filter((p) =>
      (
        meeting?.additionalMemberIds ??
        meeting?.attendeeMemberIds ??
        []
      ).includes(p._id),
    ),
  );
  const group = options.groups.find((g) => g._id === groupId);
  const [generalBranch, setGeneralBranch] = useState(
    options.branches[0]?._id || "",
  );
  const branch =
    groupId === "__church__"
      ? generalBranch
      : group
        ? referenceId(group.branchId)
        : meeting
          ? referenceId(meeting.branchId)
          : "";
  const users = options.users.filter(
    (u) => u.branchId === branch || u._id === options.userId,
  );
  const [audienceMode, setAudienceMode] = useState(
    meeting?.audienceMode || "individuals",
  );
  const [audienceGroups, setAudienceGroups] = useState<string[]>(
    meeting?.audienceServiceUnitIds || [],
  );
  const [staffIds, setStaffIds] = useState<string[]>(
    meeting?.attendeeUserIds || [],
  );
  const [sendInvitations, setSendInvitations] = useState(
    meeting ? !!meeting.invitationsRequested : true,
  );
  const [preview, setPreview] = useState<{
    memberCount: number;
    staffCount: number;
    uniqueEmails: number;
    missingEmail: number;
  } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewPayload = JSON.stringify({
    ...(groupId === "__church__" ? { branchId: branch } : { groupId }),
    ...(meeting ? { meetingId: meeting._id } : {}),
    audienceMode,
    audienceServiceUnitIds: audienceGroups,
    attendeeMemberIds: members.map((m) => m._id),
    attendeeUserIds: staffIds,
  });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (
        !groupId ||
        (groupId === "__church__" && !branch) ||
        (audienceMode === "service_groups" && !audienceGroups.length)
      ) {
        setPreview(null);
        setPreviewBusy(false);
        setPreviewError("");
        return;
      }
      setPreviewBusy(true);
      setPreviewError("");
      try {
        const response = await fetch(`${API_URL}/meetings/audience-preview`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: previewPayload,
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.message || "Could not preview audience");
        if (!controller.signal.aborted) setPreview(body);
      } catch (e) {
        if (!controller.signal.aborted) {
          setPreview(null);
          setPreviewError(
            e instanceof Error ? e.message : "Could not preview audience",
          );
        }
      } finally {
        if (!controller.signal.aborted) setPreviewBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [previewPayload, groupId, branch, audienceMode, audienceGroups.length]);
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
        attendeeUserIds: staffIds,
        audienceMode,
        audienceServiceUnitIds: audienceGroups,
        sendInvitations,
        attendeeMemberIds: members.map((m) => m._id),
      };
      const result = meeting
        ? await apiPatch<Meeting>(`/meetings/${meeting._id}`, {
            ...payload,
            operation: "details",
            expectedRevision: meeting.revision,
          })
        : await apiPost<Meeting>("/meetings", {
            ...payload,
            ...(groupId === "__church__" ? { branchId: branch } : { groupId }),
          });
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
                setAudienceGroups([]);
                setStaffIds([]);
              }}
            >
              {options.isAdmin && (
                <option value="__church__">Church / general meeting</option>
              )}
              {available.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name} —{" "}
                  {typeof g.branchId === "object" ? g.branchId.name : ""}
                </option>
              ))}
            </select>
            {!available.length && !options.isAdmin && (
              <p className="text-sm">
                An admin must enable a meeting group and assign a submitter
                first.
              </p>
            )}
          </Field>
        )}
        {groupId === "__church__" && (
          <Field label="Church / branch" required>
            <select
              className="ui-input"
              required
              value={generalBranch}
              onChange={(e) => {
                setGeneralBranch(e.target.value);
                setMembers([]);
                setStaffIds([]);
                setAudienceGroups([]);
              }}
            >
              {options.branches.map((b) => (
                <option value={b._id} key={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
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
        <Field label="Who is this meeting for?">
          <select
            className="ui-input"
            value={audienceMode}
            onChange={(e) => setAudienceMode(e.target.value)}
          >
            <option value="individuals">
              Choose individual church members
            </option>
            <option value="service_groups">
              Members of selected service groups
            </option>
            <option value="church">All active church / branch members</option>
          </select>
        </Field>
        {audienceMode === "service_groups" && (
          <Field
            label="Service groups"
            hint="All active members in these groups are included. People belonging to multiple selected groups appear once."
          >
            <div className="max-h-56 overflow-auto rounded-xl bg-white p-3 space-y-2">
              {options.serviceUnits
                .filter((unit) => unit.branchId === branch)
                .map((unit) => (
                  <label className="flex gap-2 text-sm" key={unit._id}>
                    <input
                      type="checkbox"
                      checked={audienceGroups.includes(unit._id)}
                      onChange={(e) =>
                        setAudienceGroups(
                          e.target.checked
                            ? [...audienceGroups, unit._id]
                            : audienceGroups.filter((id) => id !== unit._id),
                        )
                      }
                    />
                    {unit.name}
                  </label>
                ))}
            </div>
          </Field>
        )}
        {audienceMode === "church" && (
          <p className="text-sm">
            All active members in this meeting’s church/branch will be included.
            You can add other members individually below.
          </p>
        )}
        <Field
          label={
            audienceMode === "individuals"
              ? "Choose church members"
              : "Add other members (optional)"
          }
        >
          <MemberPicker
            key={branch}
            branchId={branch}
            selected={members}
            onChange={setMembers}
          />
        </Field>
        <Field
          label="Staff attendees (optional)"
          hint="Selected users can open this meeting and receive invitations. An email shared with a member record receives only one invitation."
        >
          <div className="max-h-52 overflow-y-auto rounded-xl bg-white p-3 space-y-2">
            {users.map((u) => (
              <label className="flex gap-2 text-sm" key={u._id}>
                <input
                  type="checkbox"
                  checked={staffIds.includes(u._id)}
                  onChange={(e) =>
                    setStaffIds(
                      e.target.checked
                        ? [...staffIds, u._id]
                        : staffIds.filter((id) => id !== u._id),
                    )
                  }
                />
                {meetingName(u)}
              </label>
            ))}
          </div>
        </Field>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={sendInvitations}
            onChange={(e) => setSendInvitations(e.target.checked)}
          />
          Send email invitations
        </label>
        <p className="text-sm text-[#6b6b6b]">
          Invitations include the meeting time, location, agenda and join link.
          Each email address is invited once per meeting, even across several
          groups or member/staff records. Saving changes emails only new
          addresses.
        </p>
        <div role="status" className="rounded-xl bg-white p-4 text-sm">
          {previewBusy
            ? "Checking audience…"
            : preview
              ? `${preview.memberCount} unique members · ${preview.staffCount} staff users · ${preview.uniqueEmails} unique email addresses`
              : audienceMode === "service_groups"
                ? "Select at least one service group to preview your audience."
                : "Select a meeting group to preview your audience."}
          {preview && !previewBusy && preview.missingEmail > 0 && (
            <p className="mt-2 text-amber-800">
              {preview.missingEmail} selected records have no valid email. They
              remain on the attendance list but cannot receive an email
              invitation.
            </p>
          )}
          {previewError && <p className="text-red-700">{previewError}</p>}
        </div>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={
            busy ||
            (!meeting && !available.length && !options.isAdmin) ||
            (audienceMode === "service_groups" && !audienceGroups.length)
          }
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
