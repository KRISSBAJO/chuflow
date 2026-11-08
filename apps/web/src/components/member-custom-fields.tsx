"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { GuestCustomAnswer, GuestField, GuestStaffForm } from "@/lib/guest-fields";

type MemberForm = GuestStaffForm & { values?: Record<string, string | number> };

export function useMemberFields(guestId?: string, enabled = true, formPath?: string) {
  const [result, setResult] = useState<{ path: string; form?: MemberForm }>();
  const path = formPath ?? (guestId ? `/members/convert/${encodeURIComponent(guestId)}/form` : "/members/staff-form");
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    void fetch(API_URL + path, { credentials: "include", cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setResult({ path, form: await response.json() as MemberForm });
      })
      .catch(() => { if (!abort.signal.aborted) setResult({ path }); });
    return () => abort.abort();
  }, [path, enabled]);
  return { form: result?.path === path ? result.form : undefined, failed: result?.path === path && !result.form };
}

export function memberFieldPayload(form: MemberForm, data: FormData) {
  return {
    formRevision: form.revision,
    customFields: Object.fromEntries(form.fields.map((field) => {
      const value = String(data.get(field.key) ?? "").trim();
      return [field.key, value && field.type === "number" ? Number(value) : value];
    })),
  };
}

export function MemberCustomFields({ fields, values, onChange }: { fields: GuestField[]; values?: MemberForm["values"]; onChange?: (values: Record<string, string | number>) => void }) {
  const locale = useLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const label = (locale === "es" && field.labelEs) || (locale === "fr" && field.labelFr) || (locale === "pt" && field.labelPt) || field.label;
        const value = values?.[field.key] ?? "";
        const props = { name: field.key, className: "ui-input", required: field.required, ...(onChange ? {
          value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            onChange({ ...values, [field.key]: event.target.value }),
        } : { defaultValue: value }) };
        return (
          <Field key={field.key} label={label} required={field.required}>
            {field.type === "select" ? (
              <select {...props}><option value="" />{field.options.map((option) => <option key={option}>{option}</option>)}</select>
            ) : field.type === "textarea" ? <textarea {...props} maxLength={2000} /> :
              <input {...props} type={field.type} maxLength={250} min={field.type === "number" ? 0 : undefined} step="any" />}
          </Field>
        );
      })}
    </div>
  );
}

export function MemberAnswersEditor({ id, answers, editable, financeKind, serviceUnit, reviewRevision, onSaved }: { id: string; answers: GuestCustomAnswer[]; editable: boolean; financeKind?: "offering" | "expense"; serviceUnit?: boolean; reviewRevision?: number; onSaved?: () => void }) {
  const t = useTranslations("admin.settings.guestFields");
  const common = useTranslations("common");
  const { form, failed } = useMemberFields(undefined, editable, financeKind ? `/finance/staff-form/${financeKind}` : serviceUnit ? "/guests/ministry-form/service-unit" : undefined);
  const [values, setValues] = useState(answers);
  const [entryRevision, setEntryRevision] = useState(reviewRevision);
  const [saving, setSaving] = useState(false);

  async function save(data: FormData) {
    if (!form) return;
    setSaving(true);
    try {
      const endpoint = financeKind ? `/finance/${financeKind}s/${id}` : serviceUnit ? `/service-units/${id}` : `/members/${id}`;
      const response = await fetch(API_URL + endpoint, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...memberFieldPayload(form, data), ...(financeKind ? { reviewRevision: entryRevision } : {}) }),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      const result = await response.json() as { customAnswers?: GuestCustomAnswer[]; reviewRevision?: number };
      setValues(result.customAnswers ?? []);
      setEntryRevision(result.reviewRevision);
      toast.success(t(financeKind ? "financeSaved" : "memberSaved"));
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!values.length && !form?.fields.length && !failed) return null;
  return (
    <section className="app-card space-y-4 p-5">
      <h2 className="font-semibold">{t(financeKind ? "financeAnswers" : serviceUnit ? "extraAnswers" : "memberAnswers")}</h2>
      {values.length ? <dl className="grid gap-3 sm:grid-cols-2">
        {values.map(({ key, label, value }) => <div key={key}><dt className="text-sm text-neutral-600">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
      </dl> : null}
      {failed ? <p role="alert">{t(financeKind ? "financeLoadFailed" : "memberLoadFailed")}</p> : null}
      {form?.fields.length ? (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(new FormData(event.currentTarget)); }}>
          <MemberCustomFields fields={form.fields} values={Object.fromEntries(values.map(({ key, value }) => [key, value]))} />
          <Button type="submit" disabled={saving}>{common(saving ? "saving" : "save")}</Button>
        </form>
      ) : null}
    </section>
  );
}
