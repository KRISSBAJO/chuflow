"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [stage, setStage] = useState(contact.stage);
  const stopped = contact.stage === "do_not_contact";
  const closed = stage === "closed" || stage === "do_not_contact";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSaved(false);
    const next = String(data.get("nextActionDate") || "");
    try {
      await apiPatch(`/evangelism/contacts/${contact._id}`, {
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
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save follow-up.");
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
      <h2 className="text-xl font-semibold">Record follow-up</h2>
      {stopped && (
        <p className="mt-3 rounded-xl bg-orange-50 p-3 text-sm">
          This person has opted out. Keep any updates administrative; do not
          call or send messages.
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <Field label="Progress" required>
          <select
            className="ui-input"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            {OUTREACH_STAGES.filter(
              ([key]) => !stopped || key === "do_not_contact",
            ).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Follow-up owner">
          <select
            name="assignedTo"
            className="ui-input"
            defaultValue={contact.assignedTo?._id || ""}
          >
            <option value="">Unassigned</option>
            {users.map((person) => (
              <option key={person._id} value={person._id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={stopped ? "Record category" : "Contact method"} required>
          <select
            name="contactMethod"
            className="ui-input"
            defaultValue={
              stopped ? "administrative" : contact.preferredContactMethod
            }
          >
            {!stopped &&
              OUTREACH_METHODS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            <option value="administrative">Administrative note</option>
          </select>
        </Field>
        <Field
          label="Next action date and time"
          hint={
            closed
              ? "Closing or opting out clears scheduled follow-up."
              : "Uses your local time zone. Leave blank to clear the schedule."
          }
        >
          <input
            name="nextActionDate"
            type="datetime-local"
            className="ui-input"
            defaultValue={localDate(contact.nextActionDate)}
            disabled={closed}
          />
        </Field>
        <Field label="What happened, and what comes next?" required>
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
        {saved && (
          <p role="status" className="text-sm text-green-700">
            Follow-up saved.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save follow-up"}
        </Button>
      </form>
    </Card>
  );
}
