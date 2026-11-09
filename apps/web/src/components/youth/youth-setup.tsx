"use client";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import type { YouthGroup, YouthOverview } from "@/lib/youth";
import { useYouthAction } from "./use-youth-action";
import { campMinorAmount } from "@/lib/youth-camp-money";

export function youthGroupValues(form: FormData) {
  return {
    program: form.get("program"), name: form.get("name"),
    minAge: Number(form.get("minAge")), maxAge: Number(form.get("maxAge")),
    guardianUnderAge: Number(form.get("guardianUnderAge")), meetingDay: Number(form.get("meetingDay")),
  };
}

export function YouthGroupFields({ group, event = false }: { group?: YouthGroup; event?: boolean }) {
  const t = useTranslations("youth");
  const locale = useLocale();
  const weekdays = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  return <>
    <Field label={t("program")}><input name="program" className="ui-input" required maxLength={80} defaultValue={group?.program} /></Field>
    <Field label={t(event ? "eventName" : "groupName")}><input name="name" className="ui-input" required maxLength={80} defaultValue={group?.name} /></Field>
    {!event ? <Field label={t("meetingDay")}><select name="meetingDay" className="ui-input" defaultValue={group?.meetingDay ?? 0}>{Array.from({ length: 7 }, (_, index) =>
      <option key={index} value={index}>{weekdays.format(Date.UTC(2026, 10, 8 + index))}</option>
    )}</select></Field> : null}
    <Field label={t("minAge")}><input name="minAge" className="ui-input" type="number" min={10} max={99} required defaultValue={group?.minAge} /></Field>
    <Field label={t("maxAge")}><input name="maxAge" className="ui-input" type="number" min={10} max={99} required defaultValue={group?.maxAge} /></Field>
    <Field label={t("guardianUnderAge")}><input name="guardianUnderAge" className="ui-input" type="number" min={18} max={25} defaultValue={group?.guardianUnderAge ?? 18} required /></Field>
  </>;
}

export function YouthSetup({ overview, defaultBranch, events = false, camps = false }: { overview: YouthOverview; defaultBranch?: string; events?: boolean; camps?: boolean }) {
  const t = useTranslations("youth");
  const { run, busy } = useYouthAction();
  function branchPicker() {
    return <Field label={t("branch")}><select name="branchId" className="ui-input" required defaultValue={defaultBranch ?? (overview.branches.length === 1 ? overview.branches[0]._id : "")}>
      <option value="">{t("chooseBranch")}</option>
      {overview.branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
    </select></Field>;
  }
  if (events || camps) return <details className="app-card p-5">
    <summary className="cursor-pointer font-semibold">{t(camps ? "createCamp" : "createEvent")}</summary>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const { program, name, minAge, maxAge, guardianUnderAge } = youthGroupValues(form);
      const currency = String(form.get("currency") ?? "USD").toUpperCase();
      const feeMinor = campMinorAmount(form.get("fee"), currency);
      const depositMinor = campMinorAmount(form.get("deposit"), currency);
      if (camps && (feeMinor === null || depositMinor === null || depositMinor > feeMinor)) {
        toast.error(t("campAmountInvalid"));
        return;
      }
      void run(camps ? "/youth/camps" : "/youth/events", "POST", {
        program, name, minAge, maxAge, guardianUnderAge, branchId: form.get("branchId"),
        venue: form.get("venue"), eventDate: form.get("eventDate"), registrationDeadline: form.get("registrationDeadline"),
        capacity: Number(form.get("capacity")),
        ...(camps ? { campEndDate: form.get("campEndDate"), currency, feeMinor, depositMinor } : {}),
      });
    }}>
      <p className="text-sm text-neutral-600">{t("eventSetupHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {branchPicker()}
        <YouthGroupFields event />
        <Field label={t("venue")}><input name="venue" className="ui-input" required maxLength={160} /></Field>
        <Field label={t("eventDate")}><input name="eventDate" type="date" className="ui-input" required /></Field>
        <Field label={t("registrationDeadline")}><input name="registrationDeadline" type="date" className="ui-input" required /></Field>
        <Field label={t("capacity")}><input name="capacity" type="number" min={1} max={2000} className="ui-input" required /></Field>
        {camps ? <>
          <Field label={t("campEndDate")}><input name="campEndDate" type="date" className="ui-input" required /></Field>
          <Field label={t("campCurrency")}><input name="currency" pattern="[A-Za-z]{3}" placeholder="USD" maxLength={3} className="ui-input" required /></Field>
          <Field label={t("campFee")}><input name="fee" type="number" min={0} step="any" defaultValue={0} className="ui-input" required /></Field>
          <Field label={t("campDeposit")}><input name="deposit" type="number" min={0} step="any" defaultValue={0} className="ui-input" required /></Field>
        </> : null}
      </div>
      <Button type="submit" disabled={busy}>{t(camps ? "createCamp" : "createEvent")}</Button>
    </form>
  </details>;
  return <section className="space-y-4">
    {overview.pilotAvailable ? <form className="app-card space-y-4 p-5" onSubmit={event => {
      event.preventDefault();
      void run("/youth/pilot", "POST", { branchId: new FormData(event.currentTarget).get("branchId") });
    }}>
      <h2 className="font-semibold">{t("pilot")}</h2><p className="text-sm text-neutral-600">{t("pilotHint")}</p>
      {branchPicker()}
      <Button type="submit" disabled={busy}>{t("startPilot")}</Button>
    </form> : null}
    <details className="app-card p-5">
      <summary className="cursor-pointer font-semibold">{t("createGroup")}</summary>
      <form className="mt-4 space-y-4" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run("/youth/groups", "POST", { branchId: form.get("branchId"), ...youthGroupValues(form) });
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          {branchPicker()}
          <YouthGroupFields />
        </div>
        <Button type="submit" disabled={busy}>{t("createGroup")}</Button>
      </form>
    </details>
  </section>;
}
