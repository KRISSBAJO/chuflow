"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CareActivityTable } from "./care-activity-table";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { apiPatch, apiPost } from "@/lib/api";
import { Card, Button, Field, buttonClass } from "@/components/ui/ui";
import { CarePicker } from "./care-picker";
import {
  careId,
  careLabel,
  isCareLabelValue,
  type CareRecord,
  type CareOptions,
  type CarePerson,
} from "@/lib/care";
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
  const t = useTranslations("people.care.detail");
  const tw = useTranslations("workspace");
  const tCare = useTranslations("people.care");
  const tsh = useTranslations("people.shared");
  const format = useFormatter();
  const label = (value: string) =>
    isCareLabelValue(value) ? tCare(`labels.${value}`) : careLabel(value);
  const when = (value?: string) =>
    value
      ? tsh("utc", {
          date: format.dateTime(new Date(value), {
            timeZone: "UTC",
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })
      : tsh("notRecorded");
  const [c, setCase] = useState(initial);
  const query = useSearchParams();
  const [tab, setTab] = useState(query.get("tab") || "timeline");
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
  const person = (id?: string) => {
    const p = c.people.find((x) => x._id === id);
    return p ? `${p.firstName} ${p.lastName}` : tsh("unassigned");
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
      setNotice(t("saved"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorSave"));
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
      setError(e instanceof Error ? e.message : t("errorLink"));
    } finally {
      setBusy(false);
    }
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
            {t("reloadLatest")}
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
            <p className="lp-label">{label(c.journey)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {c.firstName} {c.lastName}
            </h1>
            <p className="mt-2 text-sm text-[#6b6b6b]">
              {c.email || t("noEmail")}
              {c.phone ? " · " + c.phone : ""}
            </p>
          </div>
          <span
            className={`rounded-full bg-white px-3 py-1 text-sm ${c.stopContact ? "text-red-700" : "text-[#b94f0a]"}`}
          >
            {c.stopContact ? t("contactStopped") : label(c.stage)}
          </span>
        </div>
        <div className="grid gap-3 border-t border-black/5 pt-4 text-sm sm:grid-cols-3">
          <p>
            <span className="block text-xs text-[#8a8780]">
              {t("careOwner")}
            </span>
            {person(ownerId)}
          </p>
          <p>
            <span className="block text-xs text-[#8a8780]">
              {t("lastContact")}
            </span>
            {when(c.lastContactAt)}
          </p>
          <p>
            <span className="block text-xs text-[#8a8780]">
              {t("lastAttendance")}
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
              {t("guestRecord")}
            </Link>
          )}
          {c.memberId && (
            <Link
              href={"/members/" + c.memberId}
              className={buttonClass("secondary", "sm")}
            >
              {t("memberRecord")}
            </Link>
          )}
          {c.canManage && !c.automationEnrolledAt && (
            <Button
              size="sm"
              disabled={busy || c.stopContact}
              onClick={() => void change("enroll")}
            >
              {t("startPlan")}
            </Button>
          )}
        </div>
      </Card>
      {c.canAccept && (
        <Card className="p-5 space-y-3">
          <p className="font-medium">{t("handoverWaiting")}</p>
          <p className="text-sm text-[#6b6b6b]">{t("handoverPrevious")}</p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void change("accept")}>
              {t("acceptResponsibility")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void change("decline")}
            >
              {t("decline")}
            </Button>
          </div>
        </Card>
      )}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-black/10"
        aria-label={t("sectionsAria")}
      >
        {["timeline", "tasks", "connection", "preferences"].map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm ${tab === tabKey ? "border-[#ed7b19] font-semibold text-[#b94f0a]" : "border-transparent text-[#6b6b6b]"}`}
          >
            {label(tabKey)}
            {tabKey === "tasks"
              ? ` (${c.tasks.filter((x) => x.status === "open").length})`
              : ""}
          </button>
        ))}
      </nav>
      <div hidden={tab !== "timeline"} className="space-y-5">
        <details className="app-card p-5">
          <summary className="cursor-pointer font-medium">
            {t("summaryTitle")}
          </summary>
          <p className="mt-3 text-sm leading-7">{c.summary}</p>
          <p className="mt-4 text-xs text-[#8a8780]">{t("suggestedHint")}</p>
          <blockquote className="mt-2 rounded-xl bg-white p-4 text-sm">
            {c.language === "es"
              ? `Hola ${c.firstName}, queríamos saber cómo está. ¿Hay algo en lo que podamos apoyarle? Puede responder cuando le resulte conveniente.`
              : `Hi ${c.firstName}, we wanted to check how you are doing. Is there anything we can support you with? Please reply whenever it is convenient.`}
          </blockquote>
        </details>
        {c.canManage && (
          <div className="flex justify-end">
            <Link
              href={`/care/${c._id}/activities/new`}
              className={buttonClass("primary")}
            >
              + {tw("addActivity")}
            </Link>
          </div>
        )}
        <CareActivityTable record={c} />
      </div>
      <div hidden={tab !== "tasks"} className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">{t("openCommitments")}</h2>
          {c.tasks
            .filter((task) => task.status === "open")
            .map((task) => (
              <div className="rounded-xl bg-white p-4 space-y-2" key={task._id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{task.title}</h3>
                  <span className="text-xs text-[#8a8780]">
                    {when(task.dueAt)}
                    {task.escalated ? ` · ${t("leadershipReview")}` : ""}
                  </span>
                </div>
                {task.evidence && (
                  <p className="text-sm text-[#6b6b6b]">{task.evidence}</p>
                )}
                {(c.canManage || task.assignedTo === options.userId) && (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      void change("complete", {
                        taskId: task._id,
                        outcome: d.get("outcome"),
                        note: d.get("note") || undefined,
                      });
                    }}
                  >
                    <select className="ui-input max-w-xs" name="outcome">
                      {outcomes.map((o) => (
                        <option key={o} value={o}>
                          {label(o)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="ui-input flex-1 min-w-40"
                      name="note"
                      placeholder={t("outcomeNotePlaceholder")}
                      maxLength={5000}
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {t("complete")}
                    </Button>
                  </form>
                )}
              </div>
            ))}
          {!c.tasks.some((task) => task.status === "open") && (
            <p className="text-sm text-[#8a8780]">{t("noOpenCommitments")}</p>
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
              <h2 className="font-semibold">{t("addNextStep")}</h2>
              <input
                className="ui-input"
                name="title"
                aria-label={t("taskTitle")}
                required
                minLength={2}
                maxLength={200}
                placeholder={t("taskPlaceholder")}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("due")}>
                  <input
                    className="ui-input"
                    name="due"
                    type="datetime-local"
                    required
                  />
                </Field>
                <Field label={t("groupIntro")}>
                  <select className="ui-input" name="unit">
                    <option value="">{t("otherCareAction")}</option>
                    {c.units.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button type="submit" disabled={busy}>
                {t("addTask")}
              </Button>
            </form>
          </Card>
        )}
      </div>
      <div hidden={tab !== "connection"} className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">{t("belonging")}</h2>
          <div className="flex flex-wrap gap-2">
            {c.milestones.map((m) => (
              <span className="rounded-full bg-white px-3 py-1 text-sm" key={m}>
                {label(m)}
              </span>
            ))}
            {!c.milestones.length && (
              <p className="text-sm text-[#8a8780]">{t("milestonesHint")}</p>
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
                      {label(stage)}
                    </option>
                  ),
                )}
              </select>
              <Button type="submit" disabled={busy}>
                {t("updateStage")}
              </Button>
            </form>
          )}
        </Card>
        {c.canManage && (
          <Card className="p-6 space-y-5">
            <h2 className="font-semibold">{t("ownership")}</h2>
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
                <Field label={t("careOwner")}>
                  <CarePicker
                    branchId={branch}
                    selected={owner}
                    onChange={setOwner}
                    single
                  />
                </Field>
                <Field label={t("backupWorker")}>
                  <CarePicker
                    branchId={branch}
                    selected={backup}
                    onChange={setBackup}
                    single
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {t("saveOwnership")}
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
              <Field label={t("requestHandover")}>
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
                placeholder={t("handoverPlaceholder")}
              />
              <p className="text-xs text-[#8a8780]">{t("handoverNote")}</p>
              <Button type="submit" disabled={busy || !receiving.length}>
                {t("requestHandoverButton")}
              </Button>
            </form>
            {c.handover && (
              <p className="text-sm">
                {t("handoverStatus", { status: label(c.handover.status) })}
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
                <h2 className="font-semibold">{t("contactPermission")}</h2>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="emailAllowed"
                    defaultChecked={c.emailAllowed}
                  />
                  {t("emailPermission")}
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="stopContact"
                    defaultChecked={c.stopContact}
                  />
                  {t("stopContact")}
                </label>
                <Field label={t("preferredLanguage")}>
                  <select
                    className="ui-input max-w-xs"
                    name="language"
                    defaultValue={c.language}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
                <Field label={t("permissionSource")}>
                  <textarea
                    className="ui-input"
                    name="note"
                    maxLength={5000}
                    placeholder={t("permissionPlaceholder")}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {t("savePreferences")}
                </Button>
              </form>
            </Card>
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">{t("availability")}</h2>
              {c.stage === "paused" ? (
                <>
                  <p className="text-sm">
                    {t("pausedUntil", {
                      when: when(c.pausedUntil),
                      reason: c.absenceExplanation ?? "",
                    })}
                  </p>
                  <Button disabled={busy} onClick={() => void change("resume")}>
                    {t("resumeCare")}
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
                    aria-label={t("pauseUntil")}
                    required
                  />
                  <input
                    className="ui-input"
                    name="note"
                    aria-label={t("pauseReason")}
                    placeholder={t("pausePlaceholder")}
                    maxLength={5000}
                  />
                  <Button disabled={busy} type="submit" variant="secondary">
                    {t("pauseCare")}
                  </Button>
                </form>
              )}
              <div className="border-t border-black/5 pt-4 space-y-3">
                <p className="text-sm text-[#6b6b6b]">{t("checkInHint")}</p>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onClick={() => void makeLink()}
                >
                  {t("createCheckIn")}
                </Button>
                {link && (
                  <div className="flex gap-2">
                    <input
                      className="ui-input"
                      aria-label={t("privateLink")}
                      readOnly
                      value={link}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => setNotice(t("linkCopied")))
                          .catch(() => setError(t("copyFailed")));
                      }}
                    >
                      {t("copy")}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-6 space-y-3">
              <h2 className="font-semibold">{t("automationHistory")}</h2>
              {c.jobs.map((job) => (
                <div className="rounded-xl bg-white p-3 text-sm" key={job._id}>
                  <p>
                    {label(job.kind)} · {label(job.status)} · {when(job.dueAt)}
                  </p>
                  <p className="mt-1 text-xs text-[#8a8780]">{job.result}</p>
                </div>
              ))}
              {!c.jobs.length && (
                <p className="text-sm text-[#8a8780]">{t("noAutomation")}</p>
              )}
              {c.jobs.some((j) => j.status === "failed") && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void change("retry_messages")}
                >
                  {t("retryEmails")}
                </Button>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
