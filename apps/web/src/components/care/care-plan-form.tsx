"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("people.care.plan");
  const tsh = useTranslations("people.shared");
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
      setError(e instanceof Error ? e.message : t("errorSave"));
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
            {t("section1")}
          </h2>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {t("section1Hint")}
          </p>
        </div>
        <label className="flex gap-2 font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t("enablePlan")}
        </label>
        <Field
          label={t("careTeam")}
          hint={t("careTeamHint")}
        >
          <CarePicker branchId={branchId} selected={team} onChange={setTeam} />
        </Field>
        <Field label={t("leader")}>
          <CarePicker
            branchId={branchId}
            selected={leader}
            onChange={setLeader}
            single
            leadersOnly
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {numeric("firstContactHours", t("firstContactHours"), 1, 168)}
          {numeric("retryHours", t("retryHours"), 1, 336)}
          {numeric("maxAttempts", t("maxAttempts"), 1, 10)}
          {numeric("escalationHours", t("escalationHours"), 1, 336)}
          {numeric("capacity", t("capacity"), 1, 500)}
        </div>
        {team.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              {t("availability")}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {team.map((p) => (
                <Field
                  key={p._id}
                  label={t("unavailableUntil", { name: `${p.firstName} ${p.lastName}` })}
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
          {t("weeklyDigest")}
        </label>
      </Card>
      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          {t("section2")}
        </h2>
        <label className="flex gap-2 font-medium">
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
          />
          {t("enableEmails")}
        </label>
        <p className="text-sm text-[#6b6b6b]">
          {t("emailHint")}
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t("timezone")}>
            <input
              className="ui-input"
              name="timeZone"
              required
              defaultValue={plan.timeZone}
            />
          </Field>
          {numeric("quietStart", t("quietStart"), 0, 23)}
          {numeric("quietEnd", t("quietEnd"), 0, 23)}
          {numeric("maxAutomatedMessages", t("maxAutomated"), 1, 5)}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {t("templates")}
          </summary>
          <div className="mt-4 space-y-4">
            {(
              [
                "subject",
                "message",
                "subjectEs",
                "messageEs",
                "retentionSubject",
                "retentionMessage",
                "retentionSubjectEs",
                "retentionMessageEs",
              ] as const
            ).map((key) => (
              <Field label={t(key)} key={key}>
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
              {t("placeholdersHint", { placeholders: "{{firstName}}, {{churchName}}, {{checkInUrl}}" })}
            </p>
          </div>
        </details>
      </Card>
      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          {t("section3")}
        </h2>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={coverage}
            onChange={(e) => setCoverage(e.target.checked)}
          />
          <span>
            {t("attendanceReliable")}
          </span>
        </label>
        <p className="text-sm text-[#6b6b6b]">
          {t("attendanceHint")}
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="retentionEmailEnabled"
            defaultChecked={plan.retentionEmailEnabled}
          />
          {t("retentionEmail")}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("coverageFrom")}>
            <input
              className="ui-input"
              name="coverageFrom"
              type="date"
              required={coverage}
              defaultValue={plan.coverageFrom?.slice(0, 10)}
            />
          </Field>
          {numeric("absenceDays", t("absenceDays"), 7, 180)}
          {numeric("minAttendanceRecords", t("minAttendance"), 3, 30)}
        </div>
      </Card>
      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">{t("preview")}</h2>
        {plan.capabilities && !plan.capabilities.emailConfigured && (
          <p className="text-sm text-amber-800">
            {t("emailNotConfigured")}
          </p>
        )}
        <p className="text-sm">
          {enabled
            ? t("previewEnabled", { count: team.length })
            : t("previewDisabled")}
        </p>
        <p className="text-sm">
          {email
            ? t("previewEmailOn")
            : t("previewEmailOff")}
        </p>
        <p className="text-sm">
          {coverage
            ? t("previewCoverageOn")
            : t("previewCoverageOff")}
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-green-800">
            {t("saved")}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? tsh("savingEllipsis") : t("save")}
        </Button>
      </Card>
    </form>
  );
}
