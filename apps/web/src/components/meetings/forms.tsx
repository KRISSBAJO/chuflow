"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  kind = "members",
}: {
  branchId: string;
  selected: MeetingPerson[];
  onChange: (people: MeetingPerson[]) => void;
  kind?: "members" | "staff";
}) {
  const t = useTranslations("services.meetings.picker");
  const tMeetings = useTranslations("services.meetings");
  const name = (person?: MeetingPerson) => meetingName(person, tMeetings("userUnavailable"));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    query: string;
    items: MeetingPerson[];
    total: number;
  }>({ query: "", items: [], total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selectedQuery, setSelectedQuery] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);
  const listId = useId();
  const search = query.trim();
  const ready = search.length >= 2;
  const noun = kind === "staff" ? t("nouns.staff") : t("nouns.members");
  const filtered = selected.filter((p) =>
    `${name(p)} ${p.email || ""}`
      .toLowerCase()
      .includes(selectedQuery.toLowerCase()),
  );
  const selectedPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentSelectedPage = Math.min(selectedPage, selectedPages);
  const shownSelected = filtered.slice(
    (currentSelectedPage - 1) * 10,
    currentSelectedPage * 10,
  );
  const items = result.query === search ? result.items : [];
  function choose(person: MeetingPerson) {
    if (!selected.some((p) => p._id === person._id))
      onChange([...selected, person]);
    setQuery("");
    setOpen(false);
    setPage(1);
    setHighlight(0);
    setBusy(false);
    setError("");
  }
  useEffect(() => {
    if (!branchId || search.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/meetings/participants?branchId=${encodeURIComponent(branchId)}&q=${encodeURIComponent(search)}&page=${page}&kind=${kind}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error(t("searchFailed", { noun }));
        const data = (await response.json()) as {
          items: MeetingPerson[];
          total: number;
        };
        if (!controller.signal.aborted) {
          setResult({ query: search, ...data });
          setHighlight(0);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : t("searchFailedGeneric"));
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, search, page, kind, noun, t]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          className="ui-input"
          value={query}
          autoComplete="off"
          placeholder={
            kind === "staff" ? t("placeholderStaff") : t("placeholderMembers")
          }
          role="combobox"
          aria-label={t("searchAria", { noun })}
          aria-autocomplete="list"
          aria-expanded={open && ready}
          aria-controls={listId}
          aria-activedescendant={
            open && ready && items[highlight]
              ? `${listId}-${highlight}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            if (
              !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)
            )
              setOpen(false);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            setHighlight(0);
            setOpen(true);
            setError("");
            setBusy(e.target.value.trim().length >= 2);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((i) =>
                Math.min(i + 1, Math.max(0, items.length - 1)),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && ready && !busy && items[highlight])
                choose(items[highlight]);
            }
          }}
        />
        {open && ready && (
          <div
            className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg"
            onBlur={(e) => {
              if (
                !e.currentTarget.parentElement?.contains(
                  e.relatedTarget as Node,
                )
              )
                setOpen(false);
            }}
          >
            {busy ? (
              <p className="p-3 text-sm" role="status">
                {t("searching")}
              </p>
            ) : error ? (
              <p className="p-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : (
              <>
                <div
                  id={listId}
                  role="listbox"
                  aria-label={t("matchingAria", { noun })}
                  className="max-h-72 overflow-y-auto"
                >
                  {items.length === 0 && (
                    <p className="p-3 text-sm">{t("noMatches", { noun })}</p>
                  )}
                  {items.map((p, index) => (
                    <button
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected.some((x) => x._id === p._id)}
                      key={p._id}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${highlight === index ? "bg-[#f6f5f1]" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(p)}
                    >
                      <span>
                        {name(p)}
                        <span className="block text-xs text-[#6b6b6b]">
                          {p.email || t("noEmail")}
                        </span>
                      </span>
                      <span>
                        {selected.some((x) => x._id === p._id)
                          ? t("selected")
                          : "+"}
                      </span>
                    </button>
                  ))}
                </div>
                {result.total > 8 && (
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-black/5 pt-2 text-xs">
                    <span>{t("matchesRefine", { count: result.total })}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={page <= 1}
                        onClick={() => {
                          setPage(page - 1);
                          setBusy(true);
                        }}
                      >
                        {t("previous")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={page * 8 >= result.total}
                        onClick={() => {
                          setPage(page + 1);
                          setBusy(true);
                        }}
                      >
                        {t("next")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-[#6b6b6b]">{t("hint", { noun })}</p>
      {selected.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {selected.slice(0, 3).map((p) => (
              <Button
                key={p._id}
                size="sm"
                variant="secondary"
                aria-label={t("removeAria", { name: name(p) })}
                onClick={() =>
                  onChange(selected.filter((x) => x._id !== p._id))
                }
              >
                {name(p)} ×
              </Button>
            ))}
            {selected.length > 3 && (
              <span className="text-sm text-[#6b6b6b]">
                {t("more", { count: selected.length - 3 })}
              </span>
            )}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer">
              {t("reviewSelected", { count: selected.length, noun })}
            </summary>
            <div className="mt-3 space-y-3 rounded-xl bg-white p-3">
              <input
                className="ui-input"
                aria-label={t("filterSelectedAria", { noun })}
                placeholder={t("filterPlaceholder")}
                value={selectedQuery}
                onChange={(e) => {
                  setSelectedQuery(e.target.value);
                  setSelectedPage(1);
                }}
              />
              {shownSelected.map((p) => (
                <div
                  className="flex items-center justify-between gap-2"
                  key={p._id}
                >
                  <span>{name(p)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onChange(selected.filter((x) => x._id !== p._id))
                    }
                  >
                    {t("remove")}
                  </Button>
                </div>
              ))}
              {selectedPages > 1 && (
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={currentSelectedPage <= 1}
                    onClick={() => setSelectedPage(currentSelectedPage - 1)}
                  >
                    {t("previous")}
                  </Button>
                  <span>
                    {currentSelectedPage} / {selectedPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={currentSelectedPage >= selectedPages}
                    onClick={() => setSelectedPage(currentSelectedPage + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              )}
            </div>
          </details>
        </>
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
  const t = useTranslations("services.meetings.picker");
  const tMeetings = useTranslations("services.meetings");
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
            {meetingName(u, tMeetings("userUnavailable"))}
          </label>
        ))
      ) : (
        <p className="text-sm">{t("noUsers")}</p>
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
  const t = useTranslations("services.meetings.groupForm");
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
      setError(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label={t("branch")} required>
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
        <Field label={t("name")} required>
          <input
            className="ui-input"
            name="name"
            required
            minLength={2}
            maxLength={150}
            defaultValue={group?.name}
            placeholder={t("namePlaceholder")}
          />
        </Field>
        <Field label={t("relatedUnit")}>
          <select
            key={branch}
            className="ui-input"
            name="serviceUnitId"
            defaultValue={group?.serviceUnitId || ""}
          >
            <option value="">{t("otherGroup")}</option>
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
          {t("enable")}
        </label>
        <label className="flex gap-2">
          <input
            name="minutesRequired"
            type="checkbox"
            defaultChecked={group?.minutesRequired ?? true}
          />
          {t("requireMinutes")}
        </label>
        <Field label={t("dueHours")}>
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
        <p className="text-sm text-[#6b6b6b]">{t("note")}</p>
        <Field
          label={t("submitters")}
          hint={t("submittersHint")}
        >
          <UserChoices
            key={`${branch}-s`}
            name="submitterUserIds"
            users={users}
            chosen={group?.submitterUserIds}
          />
        </Field>
        <Field
          label={t("reviewers")}
          hint={t("reviewersHint")}
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
          {busy ? t("saving") : t("save")}
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
  const t = useTranslations("services.meetings.form");
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
  const [audienceMode, setAudienceMode] = useState(
    meeting?.audienceMode || "individuals",
  );
  const [audienceGroups, setAudienceGroups] = useState<string[]>(
    meeting?.audienceServiceUnitIds || [],
  );
  const [staffPeople, setStaffPeople] = useState<MeetingPerson[]>(
    (meeting?.attendeeUsers || []).filter((p) =>
      meeting?.attendeeUserIds.includes(p._id),
    ),
  );
  const staffIds = staffPeople.map((p) => p._id);
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
          throw new Error(body.message || t("previewFailed"));
        if (!controller.signal.aborted) setPreview(body);
      } catch (e) {
        if (!controller.signal.aborted) {
          setPreview(null);
          setPreviewError(
            e instanceof Error ? e.message : t("previewFailed"),
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
  }, [previewPayload, groupId, branch, audienceMode, audienceGroups.length, t]);
  function local(value?: string) {
    if (!value) return "";
    const d = new Date(value);
    return new Date(+d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  const [step, setStep] = useState(1);
  const [nowMin, setNowMin] = useState("");
  const [startValue, setStartValue] = useState(local(meeting?.startsAt));
  const [endValue, setEndValue] = useState(local(meeting?.endsAt));
  useEffect(() => {
    const update = () =>
      setNowMin(
        local(new Date(Math.ceil(Date.now() / 60000) * 60000).toISOString()),
      );
    const timer = setTimeout(update, 0);
    const interval = setInterval(update, 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  const startMin =
    meeting && startValue === local(meeting.startsAt) && startValue < nowMin
      ? startValue
      : nowMin;
  const afterStart = startValue
    ? local(new Date(new Date(startValue).getTime() + 60000).toISOString())
    : nowMin;
  const endMin =
    meeting && endValue === local(meeting.endsAt) && endValue < nowMin
      ? endValue
      : afterStart > nowMin
        ? afterStart
        : nowMin;
  function nextStep(form: HTMLFormElement) {
    for (const input of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(
      "[data-meeting-details] input,[data-meeting-details] select,[data-meeting-details] textarea",
    ))
      if (!input.checkValidity()) {
        input.reportValidity();
        input.focus();
        return;
      }
    setStep(2);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (step === 1) {
      nextStep(e.currentTarget);
      return;
    }
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
      setError(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="!bg-white border border-black/[0.07] p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-6">
        <div className="flex items-center gap-3 border-b border-black/5 pb-5 text-sm">
          <span
            className={
              step === 1 ? "font-semibold text-[#111]" : "text-[#6b6b6b]"
            }
          >
            {t("step1")}
          </span>
          <span className="text-[#b5b1aa]">→</span>
          <span
            className={
              step === 2 ? "font-semibold text-[#111]" : "text-[#6b6b6b]"
            }
          >
            {t("step2")}
          </span>
        </div>
        <fieldset
          data-meeting-details
          hidden={step !== 1}
          className="space-y-5"
        >
          {!meeting && (
            <Field label={t("group")} required>
              <select
                className="ui-input"
                value={groupId}
                required
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setMembers([]);
                  setAudienceGroups([]);
                  setStaffPeople([]);
                }}
              >
                {options.isAdmin && (
                  <option value="__church__">{t("churchGeneral")}</option>
                )}
                {available.map((g) => (
                  <option key={g._id} value={g._id}>
                    {t("groupOption", {
                      name: g.name,
                      branch: typeof g.branchId === "object" ? g.branchId.name : "",
                    })}
                  </option>
                ))}
              </select>
              {!available.length && !options.isAdmin && (
                <p className="text-sm">{t("needAdmin")}</p>
              )}
            </Field>
          )}
          {groupId === "__church__" && (
            <Field label={t("churchBranch")} required>
              <select
                className="ui-input"
                required
                value={generalBranch}
                onChange={(e) => {
                  setGeneralBranch(e.target.value);
                  setMembers([]);
                  setStaffPeople([]);
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
          <Field label={t("title")} required>
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
            <Field label={t("starts")} required>
              <input
                className="ui-input"
                name="startsAt"
                type="datetime-local"
                required
                value={startValue}
                min={startMin}
                onChange={(e) => setStartValue(e.target.value)}
              />
            </Field>
            <Field label={t("ends")} required>
              <input
                className="ui-input"
                name="endsAt"
                type="datetime-local"
                required
                value={endValue}
                min={endMin}
                onChange={(e) => setEndValue(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("location")}>
            <input
              className="ui-input"
              name="location"
              maxLength={300}
              defaultValue={meeting?.location}
            />
          </Field>
          <Field
            label={t("link")}
            hint={t("linkHint")}
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
          <Field label={t("agenda")}>
            <textarea
              className="ui-input min-h-36"
              name="agenda"
              maxLength={10000}
              defaultValue={meeting?.agenda}
            />
          </Field>
        </fieldset>
        <fieldset hidden={step !== 2} className="space-y-5">
          <Field label={t("audience")}>
            <select
              className="ui-input"
              value={audienceMode}
              onChange={(e) => setAudienceMode(e.target.value)}
            >
              <option value="individuals">{t("audienceIndividuals")}</option>
              <option value="service_groups">{t("audienceServiceGroups")}</option>
              <option value="church">{t("audienceChurch")}</option>
            </select>
          </Field>
          {audienceMode === "service_groups" && (
            <Field
              label={t("serviceGroups")}
              hint={t("serviceGroupsHint")}
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
            <p className="text-sm">{t("churchNote")}</p>
          )}
          <Field
            label={
              audienceMode === "individuals"
                ? t("chooseMembers")
                : t("addOtherMembers")
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
            label={t("staff")}
            hint={t("staffHint")}
          >
            <MemberPicker
              key={`${branch}-staff`}
              branchId={branch}
              selected={staffPeople}
              onChange={setStaffPeople}
              kind="staff"
            />
          </Field>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={sendInvitations}
              onChange={(e) => setSendInvitations(e.target.checked)}
            />
            {t("sendInvitations")}
          </label>
          <p className="text-sm text-[#6b6b6b]">{t("invitationsNote")}</p>
          <div role="status" className="rounded-xl bg-white p-4 text-sm">
            {previewBusy
              ? t("checkingAudience")
              : preview
                ? t("previewSummary", {
                    members: preview.memberCount,
                    staff: preview.staffCount,
                    emails: preview.uniqueEmails,
                  })
                : audienceMode === "service_groups"
                  ? t("selectServiceGroup")
                  : t("selectGroup")}
            {preview && !previewBusy && preview.missingEmail > 0 && (
              <p className="mt-2 text-amber-800">
                {t("missingEmail", { count: preview.missingEmail })}
              </p>
            )}
            {previewError && <p className="text-red-700">{previewError}</p>}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-black/5 pt-5">
          {step === 2 ? (
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t("backToDetails")}
            </Button>
          ) : (
            <span className="text-xs text-[#6b6b6b]">{t("stepOf")}</span>
          )}
          {step === 1 ? (
            <Button onClick={(e) => nextStep(e.currentTarget.form!)}>
              {t("continueToPeople")}
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                disabled={
                  busy ||
                  (!meeting && !available.length && !options.isAdmin) ||
                  (audienceMode === "service_groups" && !audienceGroups.length)
                }
              >
                {busy
                  ? t("saving")
                  : meeting
                    ? t("saveChanges")
                    : t("schedule")}
              </Button>
            </>
          )}
        </div>
      </form>
    </Card>
  );
}
