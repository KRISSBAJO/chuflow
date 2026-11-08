"use client";
import { MemberCustomFields, memberFieldPayload, useMemberFields } from "@/components/member-custom-fields";

import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiPatch } from "@/lib/api";
import {
  OUTREACH_METHODS,
  OUTREACH_STAGES,
  type OutreachContact,
} from "@/lib/evangelism";
import type { UserSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";

export function OutreachFollowUpForm({
  contact,
  users,
}: {
  contact: OutreachContact;
  users: UserSummary[];
}) {
  const actionToast = useActionToast();

  const router = useRouter();
  const { form: fieldDefinition, failed: fieldFailure } = useMemberFields(undefined, true, "/guests/ministry-form/outreach");
  const tf = useTranslations("admin.settings.guestFields");

  const t = useTranslations("people.evangelism.followUpForm");
  const tLabels = useTranslations("people.evangelism.labels");
  const tsh = useTranslations("people.shared");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [stage, setStage] = useState(contact.stage);
  const stopped = contact.stage === "do_not_contact";
  const closed = stage === "closed" || stage === "do_not_contact";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !fieldDefinition) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");

    const next = String(data.get("nextActionDate") || "");
    try {
      await apiPatch(`/evangelism/contacts/${contact._id}`, {
        ...memberFieldPayload(fieldDefinition, data),
        stage,
        note: data.get("note"),
        contactMethod: data.get("contactMethod"),
        assignedTo:
          data.get("assignedTo") &&
          data.get("assignedTo") !== contact.assignedTo?._id
            ? data.get("assignedTo")
            : undefined,
        unassign: !data.get("assignedTo"),
        nextActionDate:
          next && !closed ? new Date(next).toISOString() : undefined,
        clearNextAction: !next || closed,
      });
      form.reset();

      router.refresh();

      actionToast.success(t("saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorSave"));
      setError(e instanceof Error ? e.message : t("errorSave"));
    } finally {
      setBusy(false);
    }
  }
  function localDate(iso?: string) {
    if (!iso) return "";
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  return (
    <Card className="p-6 sm:p-7">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {stopped && (
        <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm">
          {t("optedOut")}
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <Field label={t("progress")} required>
          <select
            className="ui-input"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {OUTREACH_STAGES.filter(
              ([key]) => !stopped || key === "do_not_contact",
            ).map(([key]) => (
              <option key={key} value={key}>
                {tLabels(key)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("owner")}>
          <select
            name="assignedTo"
            className="ui-input"
            defaultValue={contact.assignedTo?._id || ""}
          >
            <option value="">{tsh("unassigned")}</option>
            {users.map((person) => (
              <option key={person._id} value={person._id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={stopped ? t("recordCategory") : t("contactMethod")}
          required
        >
          <select
            name="contactMethod"
            className="ui-input"
            defaultValue={
              stopped ? "administrative" : contact.preferredContactMethod
            }
          >
            {!stopped &&
              OUTREACH_METHODS.map(([key]) => (
                <option key={key} value={key}>
                  {tLabels(key)}
                </option>
              ))}
            <option value="administrative">{tLabels("administrative")}</option>
          </select>
        </Field>
        <Field
          label={t("nextAction")}
          hint={closed ? t("hintClosed") : t("hintOpen")}
        >
          <input
            name="nextActionDate"
            type="datetime-local"
            className="ui-input"
            defaultValue={localDate(contact.nextActionDate)}
            disabled={closed}
          />
        </Field>
        <Field label={t("whatHappened")} required>
          <textarea
            name="note"
            rows={4}
            className="ui-input"
            required
            maxLength={2000}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {fieldFailure ? <p role="alert">{tf("extraLoadFailed")}</p> : null}
      {fieldDefinition?.fields.length ? <MemberCustomFields fields={fieldDefinition.fields} values={Object.fromEntries((contact?.customAnswers ?? []).map(({ key, value }) => [key, value]))} /> : null}
<Button type="submit" disabled={busy || !fieldDefinition}>
          {busy ? tsh("savingEllipsis") : t("save")}
        </Button>
      </form>
    </Card>
  );
}
