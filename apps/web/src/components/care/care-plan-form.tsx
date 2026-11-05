"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPatch } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import { CarePicker } from "./care-picker";
import type { CarePlan, CarePerson } from "@/lib/care";
export function CarePlanForm({
  plan,
  branchId,
}: {
  plan: CarePlan;
  branchId: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(plan.enabled);
  const [email, setEmail] = useState(plan.emailEnabled);
  const [coverage, setCoverage] = useState(plan.attendanceReliable);
  const [team, setTeam] = useState<CarePerson[]>(
    plan.people.filter((p) => plan.teamIds.includes(p._id)),
  );
  const [leader, setLeader] = useState<CarePerson[]>(
    plan.people.filter((p) => p._id === plan.leaderId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(plan.revision);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const d = new FormData(e.currentTarget);
    try {
      const fields: Record<string, unknown> = {
        expectedRevision: revision,
        enabled,
        teamIds: team.map((p) => p._id),
        ...(leader[0] ? { leaderId: leader[0]._id } : {}),
        emailEnabled: email,
        attendanceReliable: coverage,
        retentionEmailEnabled: d.get("retentionEmailEnabled") === "on",
        weeklyDigest: d.get("weeklyDigest") === "on",
        unavailableUntil: Object.fromEntries(
          team
            .map((p) => [p._id, d.get("away-" + p._id)])
            .filter(([, date]) => date)
            .map(([id, date]) => [id, new Date(String(date)).toISOString()]),
        ),
      };
      for (const key of [
        "firstContactHours",
        "retryHours",
        "maxAttempts",
        "escalationHours",
        "capacity",
        "maxAutomatedMessages",
        "quietStart",
        "quietEnd",
        "absenceDays",
        "minAttendanceRecords",
      ])
        fields[key] = Number(d.get(key));
      for (const key of [
        "timeZone",
        "subject",
        "message",
        "subjectEs",
        "messageEs",
        "retentionSubject",
        "retentionMessage",
        "retentionSubjectEs",
        "retentionMessageEs",
      ])
        fields[key] = String(d.get(key) || "");
      if (d.get("coverageFrom"))
        fields.coverageFrom = new Date(
          String(d.get("coverageFrom")),
        ).toISOString();
      const result = await apiPatch<CarePlan>(
        "/care/plans/" + branchId,
        fields,
      );
      setRevision(result.revision);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  const numeric = (
    key: keyof CarePlan,
    label: string,
    min: number,
    max: number,
  ) => (
    <Field label={label} key={key}>
      <input
        className="ui-input"
        type="number"
        name={key}
        min={min}
        max={max}
        required
        defaultValue={Number(plan[key])}
      />
    </Field>
  );
  function local(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    return new Date(+date - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  return (
    <form onSubmit={submit} className="space-y-5 max-w-5xl">
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">
            1. Ownership and response times
          </h2>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            New registrations are enrolled only after this plan is enabled.
            Existing care histories remain visible; older people can be enrolled
            individually.
          </p>
        </div>
        <label className="flex gap-2 font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable this branch’s care plan
        </label>
        <Field
          label="Care team"
          hint="New cases go to an available worker with the lowest active caseload, within the capacity limit."
        >
          <CarePicker branchId={branchId} selected={team} onChange={setTeam} />
        </Field>
        <Field label="Branch escalation / backup leader">
          <CarePicker
            branchId={branchId}
            selected={leader}
            onChange={setLeader}
            single
            leadersOnly
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {numeric(
            "firstContactHours",
            "First contact due within (hours)",
            1,
            168,
          )}
          {numeric("retryHours", "Retry after no answer (hours)", 1, 336)}
          {numeric("maxAttempts", "Attempts before leadership review", 1, 10)}
          {numeric("escalationHours", "Escalate after overdue (hours)", 1, 336)}
          {numeric("capacity", "Active cases per worker", 1, 500)}
        </div>
        {team.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Team availability / leave cover
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {team.map((p) => (
                <Field
                  key={p._id}
                  label={`${p.firstName} ${p.lastName} — unavailable until`}
                >
                  <input
                    name={"away-" + p._id}
                    type="datetime-local"
                    className="ui-input"
                    defaultValue={local(plan.unavailableUntil?.[p._id])}
                  />
                </Field>
              ))}
            </div>
          </details>
        )}
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            name="weeklyDigest"
            defaultChecked={plan.weeklyDigest}
          />
          Send a Monday care briefing to the selected leader
        </label>
      </Card>
      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          2. Optional messages to people
        </h2>
        <label className="flex gap-2 font-medium">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          Enable automatic care emails
        </label>
        <p className="text-sm text-[#6b6b6b]">
          A person must have recorded email permission. Quiet hours, contact
          limits, recorded responses and opt-outs are checked before sending.
          Calls, SMS and WhatsApp remain staff actions.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Timezone">
            <input
              className="ui-input"
              name="timeZone"
              required
              defaultValue={plan.timeZone}
            />
          </Field>
          {numeric("quietStart", "Quiet hours start (0–23)", 0, 23)}
          {numeric("quietEnd", "Quiet hours end (0–23)", 0, 23)}
          {numeric("maxAutomatedMessages", "Maximum automatic attempts", 1, 5)}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            English and Spanish message templates
          </summary>
          <div className="mt-4 space-y-4">
            {[
              ["subject", "English subject"],
              ["message", "English message"],
              ["subjectEs", "Spanish subject"],
              ["messageEs", "Spanish message"],
              ["retentionSubject", "Participation check-in subject"],
              ["retentionMessage", "Participation check-in message"],
              ["retentionSubjectEs", "Participation subject — Spanish"],
              ["retentionMessageEs", "Participation message — Spanish"],
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                {key.toLowerCase().includes("subject") ? (
                  <input
                    className="ui-input"
                    name={key}
                    maxLength={200}
                    required
                    defaultValue={String(plan[key as keyof CarePlan])}
                  />
                ) : (
                  <textarea
                    className="ui-input min-h-32"
                    name={key}
                    maxLength={3000}
                    minLength={10}
                    required
                    defaultValue={String(plan[key as keyof CarePlan])}
                  />
                )}
              </Field>
            ))}
            <p className="text-xs text-[#8a8780]">
              Available placeholders: {"{{firstName}}"}, {"{{churchName}}"},{" "}
              {"{{checkInUrl}}"}. Every care email also includes a stop-messages
              link.
            </p>
          </div>
        </details>
      </Card>
      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          3. Participation and retention checks
        </h2>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={coverage}
            onChange={(e) => setCoverage(e.target.checked)}
          />
          <span>
            This branch consistently records individual member attendance
          </span>
        </label>
        <p className="text-sm text-[#6b6b6b]">
          Headcounts and missing records alone cannot establish an absence.
          Signals explain the last recorded attendance and the available
          baseline; staff confirm the situation personally.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="retentionEmailEnabled"
            defaultChecked={plan.retentionEmailEnabled}
          />
          Send a gentle check-in email for new participation signals, only when
          personal permission and the main email setting are enabled
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Reliable recording began">
            <input
              className="ui-input"
              name="coverageFrom"
              type="date"
              required={coverage}
              defaultValue={plan.coverageFrom?.slice(0, 10)}
            />
          </Field>
          {numeric("absenceDays", "Check after recording gap (days)", 7, 180)}
          {numeric(
            "minAttendanceRecords",
            "Minimum baseline observations",
            3,
            30,
          )}
        </div>
      </Card>
      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Plan preview</h2>
        {plan.capabilities && !plan.capabilities.emailConfigured && (
          <p className="text-sm text-amber-800">
            Email delivery is not configured on the server. Internal care tasks
            can run, but external emails will remain unsent until the mail
            provider is configured.
          </p>
        )}
        <p className="text-sm">
          {enabled
            ? `${team.length} selected workers will receive eligible new care cases. Manual enrollment remains available for existing records.`
            : "Automation will remain off. Existing records can still be managed manually."}
        </p>
        <p className="text-sm">
          {email
            ? "Emails require individual permission and are limited by the selected contact rules."
            : "No automatic emails will be sent to guests or members."}
        </p>
        <p className="text-sm">
          {coverage
            ? "Participation checks will use confirmed individual attendance coverage and the minimum observation threshold."
            : "Absence signals are off because individual attendance coverage is not confirmed."}
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-green-800">
            Care plan saved.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save care plan"}
        </Button>
      </Card>
    </form>
  );
}
