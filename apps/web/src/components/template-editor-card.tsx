"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import { TemplateQrCard } from "./template-qr-card";
import type { BranchSummary, IntakeTemplate, IntakeTemplateField } from "@/lib/types";

const fieldTypes = ["text", "email", "tel", "date", "textarea", "radio", "select", "number"];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function starterFields(kind: IntakeTemplate["kind"]): IntakeTemplateField[] {
  if (kind === "guest") {
    return [
      { key: "visitDate", label: "Today's date", type: "date", required: true, width: "half" },
      { key: "firstName", label: "First name", type: "text", required: true, width: "half" },
      { key: "lastName", label: "Last name", type: "text", required: true, width: "half" },
      { key: "email", label: "Email", type: "email", required: true, width: "full" },
      { key: "phone", label: "Phone", type: "tel", required: true, width: "full" },
    ];
  }

  if (kind === "member") {
    return [
      { key: "dateJoinedChurch", label: "Date joined the church", type: "date", required: true, width: "half" },
      { key: "firstName", label: "First name", type: "text", required: true, width: "half" },
      { key: "lastName", label: "Last name", type: "text", required: true, width: "half" },
      { key: "email", label: "Email", type: "email", required: true, width: "half" },
      { key: "phone", label: "Phone number", type: "tel", required: true, width: "half" },
    ];
  }

  return [
    { key: "serviceDate", label: "Day of service", type: "date", required: true, width: "half" },
    { key: "serviceType", label: "Service type", type: "select", required: true, width: "half", options: ["Sunday service", "Midweek service"] },
    { key: "serviceName", label: "Service name", type: "text", required: true, width: "full" },
    { key: "menCount", label: "Number of men", type: "number", required: true, width: "half" },
    { key: "womenCount", label: "Number of women", type: "number", required: true, width: "half" },
  ];
}

function sanitizeField(field: IntakeTemplateField): IntakeTemplateField {
  return {
    key: slugify(field.key || field.label),
    label: field.label.trim() || "Untitled field",
    type: field.type,
    required: !!field.required,
    placeholder: field.placeholder?.trim() || undefined,
    helpText: field.helpText?.trim() || undefined,
    width: field.width === "full" ? "full" : "half",
    options:
      field.type === "radio" || field.type === "select" || field.type === "checkbox"
        ? (field.options || []).map((option) => option.trim()).filter(Boolean)
        : undefined,
  };
}

function sanitizeTheme(theme?: IntakeTemplate["theme"]) {
  return {
    accentColor: theme?.accentColor || "#dc2626",
    darkColor: theme?.darkColor || "#111827",
    softColor: theme?.softColor || "#fff7ed",
  };
}

function toEditableTemplate(template: IntakeTemplate): IntakeTemplate {
  return {
    _id: template._id,
    kind: template.kind,
    name: template.name,
    slug: template.slug,
    branchId: template.branchId,
    baseTemplateId: template.baseTemplateId,
    isBranchOverride: template.isBranchOverride,
    isActive: template.isActive,
    isSeeded: template.isSeeded,
    badge: template.badge || "",
    title: template.title,
    subtitle: template.subtitle || "",
    introTitle: template.introTitle || "",
    introBody: template.introBody || "",
    closingText: template.closingText || "",
    submitLabel: template.submitLabel || "Submit form",
    successTitle: template.successTitle || "Thank you",
    successMessage: template.successMessage || "Your submission has been received.",
    logoPath: template.logoPath || "/logo.png",
    shareUrl: template.shareUrl,
    theme: sanitizeTheme(template.theme),
    fields: template.fields.map(sanitizeField),
  };
}

function defaultTemplate(kind: IntakeTemplate["kind"], defaultBranchId?: string): IntakeTemplate {
  return {
    _id: "",
    kind,
    name: "",
    slug: "",
    branchId: defaultBranchId,
    baseTemplateId: undefined,
    isBranchOverride: false,
    isActive: true,
    badge: "",
    title: "",
    subtitle: "",
    introTitle: "",
    introBody: "",
    closingText: "",
    submitLabel: "Submit form",
    successTitle: "Thank you",
    successMessage: "Your submission has been received.",
    logoPath: "/logo.png",
    theme: {
      accentColor: "#dc2626",
      darkColor: "#111827",
      softColor: "#fff7ed",
    },
    fields: starterFields(kind),
  };
}

export function TemplateEditorCard({
  template,
  branches,
  currentUserRole,
  defaultBranchId,
  readonly = false,
}: {
  template?: IntakeTemplate;
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  readonly?: boolean;
}) {
  const router = useRouter();
  const baseTemplate = template ? toEditableTemplate(template) : defaultTemplate("guest", defaultBranchId);
  const [draft, setDraft] = useState<IntakeTemplate>(baseTemplate);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const branchLabel = branches.find((branch) => branch._id === draft.branchId)?.name;
  const isGlobalBaseTemplate = !!template?._id && !template.branchId && !template.isBranchOverride;
  const isBranchVersion = !!template?._id && (!!template.branchId || !!template.isBranchOverride);
  const canCreateBranchVersion =
    isGlobalBaseTemplate && isBranchScopedRole(currentUserRole) && !!defaultBranchId;

  function updateDraft<K extends keyof IntakeTemplate>(key: K, value: IntakeTemplate[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateTheme(key: "accentColor" | "darkColor" | "softColor", value: string) {
    setDraft((current) => ({
      ...current,
      theme: {
        ...current.theme,
        [key]: value,
      },
    }));
  }

  function updateField(index: number, patch: Partial<IntakeTemplateField>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    }));
  }

  function addField() {
    setDraft((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          key: `field_${current.fields.length + 1}`,
          label: "New field",
          type: "text",
          required: false,
          width: "half",
          options: [],
        },
      ],
    }));
  }

  function removeField(index: number) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
    }));
  }

  function resetForKind(kind: IntakeTemplate["kind"]) {
    setDraft((current) => ({
      ...current,
      kind,
      fields: starterFields(kind),
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setStatus(null);

    try {
      const payload = {
        kind: draft.kind,
        name: draft.name.trim(),
        slug: slugify(draft.slug || draft.name),
        isActive: draft.isActive,
        badge: draft.badge?.trim() || undefined,
        title: draft.title.trim(),
        subtitle: draft.subtitle?.trim() || undefined,
        introTitle: draft.introTitle?.trim() || undefined,
        introBody: draft.introBody?.trim() || undefined,
        closingText: draft.closingText?.trim() || undefined,
        submitLabel: draft.submitLabel?.trim() || undefined,
        successTitle: draft.successTitle?.trim() || undefined,
        successMessage: draft.successMessage?.trim() || undefined,
        logoPath: draft.logoPath?.trim() || undefined,
        branchId:
          !isBranchScopedRole(currentUserRole) ? draft.branchId || undefined : defaultBranchId || undefined,
        theme: sanitizeTheme(draft.theme),
        fields: draft.fields.map(sanitizeField),
      };

      const response = await fetch(
        `${API_URL}/intake-templates${template?._id ? `/${template._id}` : ""}`,
        {
          method: template?._id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to save template");
      }

      const message = template?._id ? "Template updated." : "Template created.";
      setStatus(message);
      toast.success(message);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save template";
      setStatus(message);
      toast.error("Template save failed", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBranchVersion() {
    if (!template?._id || !defaultBranchId) {
      return;
    }

    setOverrideLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/intake-templates/${template._id}/branch-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId: defaultBranchId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create branch version");
      }

      const message = "Branch version created.";
      setStatus(message);
      toast.success(message);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create branch version";
      setStatus(message);
      toast.error("Branch version unavailable", {
        description: message,
      });
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {template?.shareUrl && !(isGlobalBaseTemplate && canCreateBranchVersion) ? (
        <TemplateQrCard url={template.shareUrl} title={`${draft.name} share link`} />
      ) : null}
      {template ? (
        <section className="rounded-[20px] border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {isGlobalBaseTemplate ? "Global base template" : isBranchVersion ? "Branch version" : "Template"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {isGlobalBaseTemplate
                  ? "This shared template stays centrally managed."
                  : `This version only applies to ${branchLabel || "the selected branch"}.`}
              </p>
            </div>
            {isBranchVersion && branchLabel ? (
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                {branchLabel}
              </span>
            ) : null}
          </div>
          {canCreateBranchVersion ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
              <p>Start a branch version to customize this template for your branch.</p>
              <button
                type="button"
                onClick={handleCreateBranchVersion}
                disabled={overrideLoading}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {overrideLoading ? "Creating..." : "Create branch version"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="grid gap-2.5 md:grid-cols-2">
          <input
            value={draft.name}
            onChange={(event) => updateDraft("name", event.target.value)}
            placeholder="Template name"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            value={draft.slug}
            onChange={(event) => updateDraft("slug", event.target.value)}
            placeholder="public-slug"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <select
            value={draft.kind}
            onChange={(event) => resetForKind(event.target.value as IntakeTemplate["kind"])}
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          >
            <option value="guest">First timer</option>
            <option value="member">Member</option>
            <option value="attendance">Attendance summary</option>
          </select>
          {!isBranchScopedRole(currentUserRole) ? (
            <select
              value={draft.branchId || ""}
              onChange={(event) => updateDraft("branchId", event.target.value || undefined)}
              disabled={readonly}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">No branch selected</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={branchLabel || "Current branch scope"}
              readOnly
              className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 outline-none"
            />
          )}
          <input
            value={draft.badge || ""}
            onChange={(event) => updateDraft("badge", event.target.value)}
            placeholder="Badge / eyebrow"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => updateDraft("isActive", event.target.checked)}
              disabled={readonly}
              className="h-4 w-4"
            />
            Active public template
          </label>
          <input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="Public title"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <input
            value={draft.subtitle || ""}
            onChange={(event) => updateDraft("subtitle", event.target.value)}
            placeholder="Public subtitle"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <input
            value={draft.introTitle || ""}
            onChange={(event) => updateDraft("introTitle", event.target.value)}
            placeholder="Intro title"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <textarea
            value={draft.introBody || ""}
            onChange={(event) => updateDraft("introBody", event.target.value)}
            placeholder="Intro body"
            disabled={readonly}
            className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <textarea
            value={draft.closingText || ""}
            onChange={(event) => updateDraft("closingText", event.target.value)}
            placeholder="Closing text"
            disabled={readonly}
            className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <input
            value={draft.submitLabel || ""}
            onChange={(event) => updateDraft("submitLabel", event.target.value)}
            placeholder="Submit label"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            value={draft.logoPath || ""}
            onChange={(event) => updateDraft("logoPath", event.target.value)}
            placeholder="/logo.png"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            value={draft.successTitle || ""}
            onChange={(event) => updateDraft("successTitle", event.target.value)}
            placeholder="Success title"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            value={draft.successMessage || ""}
            onChange={(event) => updateDraft("successMessage", event.target.value)}
            placeholder="Success message"
            disabled={readonly}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          />
          <input
            type="color"
            value={draft.theme?.accentColor || "#dc2626"}
            onChange={(event) => updateTheme("accentColor", event.target.value)}
            disabled={readonly}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1"
          />
          <input
            type="color"
            value={draft.theme?.darkColor || "#111827"}
            onChange={(event) => updateTheme("darkColor", event.target.value)}
            disabled={readonly}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1"
          />
          <input
            type="color"
            value={draft.theme?.softColor || "#fff7ed"}
            onChange={(event) => updateTheme("softColor", event.target.value)}
            disabled={readonly}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1"
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Template fields</p>
            <p className="mt-1 text-xs text-slate-500">Edit the labels, field types, options, and required rules.</p>
          </div>
          {!readonly ? (
            <button
              type="button"
              onClick={addField}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Add field
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {draft.fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2.5 md:grid-cols-2">
                <input
                  value={field.label}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  disabled={readonly}
                  placeholder="Field label"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                />
                <input
                  value={field.key}
                  onChange={(event) => updateField(index, { key: event.target.value })}
                  disabled={readonly}
                  placeholder="field_key"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                />
                <select
                  value={field.type}
                  onChange={(event) => updateField(index, { type: event.target.value })}
                  disabled={readonly}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  {fieldTypes.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {fieldType}
                    </option>
                  ))}
                </select>
                <select
                  value={field.width || "half"}
                  onChange={(event) => updateField(index, { width: event.target.value })}
                  disabled={readonly}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                >
                  <option value="half">Half width</option>
                  <option value="full">Full width</option>
                </select>
                <input
                  value={field.placeholder || ""}
                  onChange={(event) => updateField(index, { placeholder: event.target.value })}
                  disabled={readonly}
                  placeholder="Placeholder"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                />
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    disabled={readonly}
                    className="h-4 w-4"
                  />
                  Required field
                </label>
                <textarea
                  value={field.helpText || ""}
                  onChange={(event) => updateField(index, { helpText: event.target.value })}
                  disabled={readonly}
                  placeholder="Helper text"
                  className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none md:col-span-2"
                />
                {field.type === "select" || field.type === "radio" ? (
                  <input
                    value={(field.options || []).join(", ")}
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                      })
                    }
                    disabled={readonly}
                    placeholder="Option 1, Option 2, Option 3"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none md:col-span-2"
                  />
                ) : null}
              </div>
              {!readonly ? (
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="mt-3 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
                >
                  Remove field
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {!readonly ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {loading ? "Saving..." : template?._id ? "Update template" : "Create template"}
          </button>
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {canCreateBranchVersion
            ? "This shared template stays locked at the global level. Create a branch version to make local changes."
            : "This shared template is locked at the global level."}
        </p>
      )}
    </div>
  );
}
