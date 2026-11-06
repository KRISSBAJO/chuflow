"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { Card, Button, Field, buttonClass } from "@/components/ui/ui";
import { careLabel, isCareLabelValue, type CareRecord } from "@/lib/care";
const outcomes = [
  "contacted",
  "no_answer",
  "callback_requested",
  "needs_help",
  "connected",
  "declined",
  "resolved",
];
export function CareActivityForm({ initial }: { initial: CareRecord }) {
  const router = useRouter();
  const [c, setCase] = useState(initial);
  const t = useTranslations("people.care.detail");
  const tCare = useTranslations("people.care");
  const tsh = useTranslations("people.shared");
  const tw = useTranslations("workspace");
  const label = (value: string) =>
    isCareLabelValue(value) ? tCare(`labels.${value}`) : careLabel(value);
  const [entryKind, setEntryKind] = useState(
    initial.stopContact ? "note" : "contact",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function note(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiPatch<CareRecord>(`/care/cases/${c._id}`, {
        expectedRevision: c.revision,
        operation: entryKind,
        note: d.get("note"),
        visibility: d.get("visibility") || "team",
        ...(entryKind === "contact"
          ? {
              outcome: d.get("outcome"),
              method: d.get("method"),
              ...(d.get("taskId") ? { taskId: d.get("taskId") } : {}),
            }
          : {}),
        ...(d.get("nextActionAt")
          ? {
              nextActionAt: new Date(
                String(d.get("nextActionAt")),
              ).toISOString(),
            }
          : {}),
      });
      toast.success(t("saved"));
      router.push(`/care/${c._id}?tab=timeline`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorSave"));
      setError(e instanceof Error ? e.message : t("errorSave"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const { apiGet } = await import("@/lib/api");
              try {
                setCase(await apiGet<CareRecord>(`/care/cases/${c._id}`));
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : t("errorSave"));
              }
            }}
          >
            {t("reloadLatest")}
          </Button>
        </div>
      )}
      <Card className="p-6">
        <form onSubmit={note} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              className="ui-input max-w-xs"
              aria-label={tw("activityType")}
              value={entryKind}
              onChange={(e) => setEntryKind(e.target.value)}
            >
              <option value="contact" disabled={c.stopContact}>
                {t("recordConversation")}
              </option>
              <option value="note">{t("addNote")}</option>
            </select>
            {c.isAdmin && (
              <select
                className="ui-input max-w-xs"
                name="visibility"
                aria-label={t("noteAccess")}
              >
                <option value="team">{t("teamVisibility")}</option>
                <option value="pastoral">{t("pastoralVisibility")}</option>
              </select>
            )}
          </div>
          <textarea
            className="ui-input min-h-28"
            name="note"
            aria-label={tw("activityNotes")}
            required
            maxLength={5000}
            placeholder={t("notePlaceholder")}
          />
          {entryKind === "contact" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("outcome")}>
                <select className="ui-input" name="outcome">
                  {outcomes.map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("method")}>
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
                      {label(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("completeTask")}>
                <select className="ui-input" name="taskId">
                  <option value="">{t("conversationOnly")}</option>
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
          <Field label={t("nextActionOptional")}>
            <input
              type="datetime-local"
              name="nextActionAt"
              className="ui-input max-w-sm"
            />
          </Field>
          <p className="text-xs text-[#8a8780]">{t("staffActivityNote")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/care/${c._id}?tab=timeline`}
              className={buttonClass("secondary")}
            >
              {tw("cancel")}
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? tsh("savingEllipsis") : t("saveToTimeline")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
