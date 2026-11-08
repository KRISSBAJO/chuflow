"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { ministryFormKinds, type MinistryFormKind, type GuestField, type GuestFormSettings } from "@/lib/guest-fields";

const kinds: GuestField["type"][] = ["text", "textarea", "number", "select", "email", "tel"];

export function GuestFieldsSettings({ initial, kind = "guests" }: { initial: GuestFormSettings; kind?: "guests" | "members" | "offering" | "expense" | MinistryFormKind }) {
  const ministry = (ministryFormKinds as readonly string[]).includes(kind);
  const staffOnly = !["guests", "members", "outreach", "child", "family"].includes(kind);
  const finance = kind === "offering" || kind === "expense";
  const t = useTranslations("admin.settings.guestFields");
  const locale = useLocale();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [choices, setChoices] = useState<Record<number, string>>({});

  function setField(index: number, change: Partial<GuestField>) {
    setSettings((current) => ({
      ...current,
      fields: current.fields.map((field, position) => position === index ? { ...field, ...change } : field),
    }));
  }

  function toggleDefault(surface: "hiddenPublic" | "hiddenStaff", key: string) {
    setSettings((current) => ({
      ...current,
      [surface]: current[surface].includes(key)
        ? current[surface].filter((value) => value !== key)
        : [...current[surface], key],
    }));
  }

  async function publish() {
    setSaving(true);
    try {
      const response = await fetch(API_URL + (finance ? `/finance/form-settings/${kind}` : ministry ? `/guests/ministry-form-settings/${kind}` : `/${kind}/form-settings`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: settings.revision,
          hiddenPublic: settings.hiddenPublic,
          hiddenStaff: settings.hiddenStaff,
          fields: settings.fields.map((field, index) => ({
            ...field,
            options: field.type === "select"
              ? (choices[index] ?? field.options.join("\n")).split("\n").map((option) => option.trim()).filter(Boolean)
              : [],
          })),
        }),
      });
      if (!response.ok) {
        toast.error(t(response.status === 409 ? "conflict" : "failed"));
        return;
      }
      setSettings(await response.json() as GuestFormSettings);
      setChoices({});
      toast.success(t(ministry ? "ministryPublished" : finance ? "financePublished" : kind === "members" ? "memberPublished" : "published"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void publish(); }}>
      <fieldset disabled={saving} className="space-y-6">
        <p className="text-sm text-neutral-600">{t(ministry ? "ministryLocked" : finance ? "financeLocked" : kind === "guests" ? "locked" : "memberLocked")}</p>
        <div className="grid gap-5 md:grid-cols-2">
          {!staffOnly ? <fieldset className="space-y-2 rounded-xl border border-black/10 p-4">
            <legend className="px-2 font-medium">{t(kind === "guests" ? "public" : kind === "outreach" ? "outreachPublic" : kind === "child" || kind === "family" ? "parentPublic" : "memberPublic")}</legend>
            {settings.defaultPublic.map(({ key, label, labelEs }) => (
              <label className="flex items-center gap-2 text-sm" key={key}>
                <input type="checkbox" checked={!settings.hiddenPublic.includes(key)} onChange={() => toggleDefault("hiddenPublic", key)} />
                {locale === "es" ? labelEs || label : label}
              </label>
            ))}
          </fieldset> : null}
          <fieldset className="space-y-2 rounded-xl border border-black/10 p-4">
            <legend className="px-2 font-medium">{t("staff")}</legend>
            {settings.defaultStaff.map((key) => (
              <label className="flex items-center gap-2 text-sm" key={key}>
                <input type="checkbox" checked={!settings.hiddenStaff.includes(key)} onChange={() => toggleDefault("hiddenStaff", key)} />
                {t(`defaults.${key}`)}
              </label>
            ))}
          </fieldset>
        </div>
        <h3 className="font-semibold">{t("custom", { count: settings.fields.length })}</h3>
        <p className="text-sm text-neutral-600">{t(ministry ? "ministryArchive" : finance ? "financeArchive" : kind === "members" ? "memberArchive" : "archive")}</p>
        {settings.fields.map((field, index) => (
          <div className="space-y-3 rounded-xl border border-black/10 p-4" key={field.key || index}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">{t("label")}
                <input className="ui-input" required maxLength={100} value={field.label} onChange={(event) => setField(index, { label: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm">{t("type")}
                <select className="ui-input" disabled={Boolean(field.key)} value={field.type} onChange={(event) => setField(index, { type: event.target.value as GuestField["type"] })}>
                  {kinds.map((kind) => <option key={kind} value={kind}>{t(`types.${kind}`)}</option>)}
                </select>
              </label>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer">{t("translations")}</summary>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                {(["labelEs", "labelFr", "labelPt"] as const).map((key) => (
                  <label className="space-y-1" key={key}>{t(key)}
                    <input className="ui-input" maxLength={100} value={field[key] ?? ""} onChange={(event) => setField(index, { [key]: event.target.value })} />
                  </label>
                ))}
              </div>
            </details>
            {field.type === "select" ? (
              <label className="block space-y-1 text-sm">{t("options")}
                <textarea className="ui-input" rows={3} required maxLength={2019} value={choices[index] ?? field.options.join("\n")} onChange={(event) => setChoices({ ...choices, [index]: event.target.value })} />
              </label>
            ) : null}
            {kind === "members" ? (
              <label className="block space-y-1 text-sm">{t("guestSource")}
                <select className="ui-input" aria-label={t("guestSource")} value={field.guestFieldKey ?? ""} onChange={(event) => setField(index, { guestFieldKey: event.target.value || undefined })}>
                  <option value="">{t("noGuestSource")}</option>
                  {settings.guestFields?.filter((guest) => guest.type === field.type).map((guest) =>
                    <option key={guest.key} value={guest.key}>{guest.label}</option>)}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-4 text-sm">
              {(["public", "staff", "required"] as const).filter((key) => !staffOnly || key !== "public").map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={field[key]} onChange={(event) => setField(index, { [key]: event.target.checked })} />
                  {t(key)}
                </label>
              ))}
              {!field.key && index === settings.fields.length - 1 ? (
                <button type="button" className="underline" onClick={() => {
                  setSettings({ ...settings, fields: settings.fields.slice(0, -1) });
                  setChoices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== index)));
                }}>{t("removeDraft")}</button>
              ) : null}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="ui-input w-auto" disabled={settings.fields.length >= 20} onClick={() => setSettings({
            ...settings,
            fields: [...settings.fields, { key: "", label: "", type: "text", options: [], public: !staffOnly && kind !== "child" && kind !== "family", staff: true, required: false }],
          })}>{t("add")}</button>
          <Button type="submit" disabled={saving}>{t(saving ? "publishing" : "publish")}</Button>
        </div>
      </fieldset>
    </form>
  );
}
