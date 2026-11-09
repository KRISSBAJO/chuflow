"use client";

import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import type { YouthEventFollowUp } from "@/lib/youth";
import { useYouthAction } from "./use-youth-action";

type FollowUpContext = {
  date: string;
  present: string[];
  attendanceRecorded?: boolean;
  followUpOwners?: { _id: string; firstName: string; lastName: string }[];
};

const followUpOutcomes = ["open", "connected", "no_response", "declined"] as const;

export function EventFollowUp({ person, data, path }: { person: { _id: string; campFollowUp?: YouthEventFollowUp }; data: FollowUpContext; path: string }) {
  const t = useTranslations("youth.campFollowUp");
  const { run, busy } = useYouthAction();
  const task = person.campFollowUp;
  const owners = data.followUpOwners ?? [];
  const date = task?.date ?? data.date;
  const reasons = task
    ? [task.reason]
    : data.present.includes(person._id) ? ["welcome", "invite"] as const : ["missed"] as const;
  if (!task && (!data.attendanceRecorded || data.date > new Date().toISOString().slice(0, 10) || !owners.length)) return null;
  return <details className="rounded-lg border border-black/10 p-3">
    <summary className="cursor-pointer text-sm font-semibold">
      {task ? t(`outcomes.${task.outcome}`) + " · " + task.dueDate : t("assign")}
    </summary>
    <form key={task?.revision ?? data.date} className="mt-3 space-y-3" onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      void run(path + "/follow-up", "PATCH", { ...Object.fromEntries(fields), date, revision: task?.revision ?? 0 });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("reason")}><select name="reason" className="ui-input">
          {reasons.map(reason => <option key={reason} value={reason}>{t(`reasons.${reason}`)}</option>)}
        </select></Field>
        <Field label={t("owner")}><select name="ownerId" className="ui-input" required defaultValue={task?.ownerId ?? ""}>
          <option value="" disabled>{t("chooseOwner")}</option>
          {task && !owners.some(owner => owner._id === task.ownerId) ? <option value={task.ownerId} disabled>{t("chooseOwner")}</option> : null}
          {owners.map(owner => <option key={owner._id} value={owner._id}>{owner.firstName} {owner.lastName}</option>)}
        </select></Field>
        <Field label={t("dueDate")}><input className="ui-input" type="date" name="dueDate" min={date} required defaultValue={task?.dueDate} /></Field>
        <Field label={t("outcome")}><select className="ui-input" name="outcome" defaultValue={task?.outcome ?? "open"}>
          {followUpOutcomes.map(outcome => <option key={outcome} value={outcome}>{t(`outcomes.${outcome}`)}</option>)}
        </select></Field>
      </div>
      <Button type="submit" size="sm" disabled={busy || !owners.length}>{t("save")}</Button>
    </form>
  </details>;
}
