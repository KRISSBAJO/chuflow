"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formTextColor } from "@/lib/form-colors";
import { createdHref } from "@/lib/directory";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import {
  isBranchScopedRole,
  isDistrictRole,
  isNationalRole,
} from "@/lib/permissions";
import { TemplateQrCard } from "./template-qr-card";
import { Badge, Button, Field } from "@/components/ui/ui";
import type {
  BranchSummary,
  IntakeTemplate,
  IntakeTemplateField,
} from "@/lib/types";

const fieldTypes = [
  "text",
  "email",
  "tel",
  "date",
  "month",
  "textarea",
  "radio",
  "checkbox",
  "select",
  "number",
];

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
      {
        key: "visitDate",
        label: "Today's date",
        type: "date",
        required: true,
        width: "half",
      },
      {
        key: "firstName",
        label: "First name",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "lastName",
        label: "Last name",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "email",
        label: "Email",
        type: "email",
        required: true,
        width: "full",
      },
      {
        key: "phone",
        label: "Phone",
        type: "tel",
        required: true,
        width: "full",
      },
    ];
  }

  if (kind === "member") {
    return [
      {
        key: "dateJoinedChurch",
        label: "Date joined the church",
        type: "date",
        required: true,
        width: "half",
      },
      {
        key: "firstName",
        label: "First name",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "lastName",
        label: "Last name",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "email",
        label: "Email",
        type: "email",
        required: true,
        width: "half",
      },
      {
        key: "phone",
        label: "Phone number",
        type: "tel",
        required: true,
        width: "half",
      },
    ];
  }

  if (kind === "weekly_report") {
    return [
      {
        key: "reportWeek",
        label: "Report week ending",
        type: "date",
        required: true,
        width: "half",
      },
      {
        key: "currentAttendance",
        label: "Current attendance",
        type: "number",
        required: true,
        width: "half",
      },
      {
        key: "previousAttendance",
        label: "Previous attendance",
        type: "number",
        required: false,
        width: "half",
      },
      {
        key: "firstTimersCount",
        label: "FT - First timers",
        type: "number",
        required: false,
        width: "half",
      },
      {
        key: "newConvertsCount",
        label: "NC - New converts",
        type: "number",
        required: false,
        width: "half",
      },
      {
        key: "remarks",
        label: "Remarks",
        type: "textarea",
        required: false,
        width: "full",
      },
    ];
  }

  if (kind === "maag_report") {
    return [
      {
        key: "reportMonth",
        label: "Month and year",
        type: "month",
        required: true,
        width: "half",
      },
      {
        key: "nation",
        label: "Nation",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "stationName",
        label: "Station",
        type: "text",
        required: true,
        width: "half",
      },
      {
        key: "facilityType",
        label: "Facility type",
        type: "select",
        required: true,
        width: "half",
        options: ["Ministry Owned", "Rented", "Temporary Structure"],
      },
      {
        key: "averageAttendance",
        label: "Avg att'd",
        type: "number",
        required: true,
        width: "half",
      },
      {
        key: "incomeAmount",
        label: "Income ($ dollars only)",
        type: "number",
        required: true,
        width: "half",
      },
    ];
  }

  return [
    {
      key: "serviceDate",
      label: "Day of service",
      type: "date",
      required: true,
      width: "half",
    },
    {
      key: "serviceType",
      label: "Service type",
      type: "select",
      required: true,
      width: "half",
      options: ["Sunday service", "Midweek service"],
    },
    {
      key: "serviceName",
      label: "Service name",
      type: "text",
      required: true,
      width: "full",
    },
    {
      key: "menCount",
      label: "Number of men",
      type: "number",
      required: true,
      width: "half",
    },
    {
      key: "womenCount",
      label: "Number of women",
      type: "number",
      required: true,
      width: "half",
    },
  ];
}

function sanitizeField(field: IntakeTemplateField): IntakeTemplateField {
  return {
    key: slugify(field.key || field.label),
    label: field.label.trim() || "Untitled field",
    labelEs: field.labelEs?.trim() || undefined,
    optionsEs: field.optionsEs?.map((option) => option.trim()),
    helpTextEs: field.helpTextEs?.trim() || undefined,
    placeholderEs: field.placeholderEs?.trim() || undefined,
    type: field.type,
    required: !!field.required,
    defaultValue: field.defaultValue?.trim() || undefined,
    placeholder: field.placeholder?.trim() || undefined,
    helpText: field.helpText?.trim() || undefined,
    width: field.width === "full" ? "full" : "half",
    options:
      field.type === "radio" ||
      field.type === "select" ||
      field.type === "checkbox"
        ? (field.options || []).map((option) => option.trim()).filter(Boolean)
        : undefined,
  };
}

function sanitizeTheme(theme?: IntakeTemplate["theme"]) {
  return {
    headerColor: theme?.headerColor || undefined,
    headerTextColor: theme?.headerTextColor || undefined,
    buttonTextColor: theme?.buttonTextColor || undefined,
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
    oversightRegion: template.oversightRegion,
    district: template.district,
    baseTemplateId: template.baseTemplateId,
    isBranchOverride: template.isBranchOverride,
    isDistrictOverride: template.isDistrictOverride,
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
    successMessage:
      template.successMessage || "Your submission has been received.",
    logoPath: template.logoPath || "/logo.png",
    spanish: template.spanish,
    shareUrl: template.shareUrl,
    theme: sanitizeTheme(template.theme),
    fields: template.fields.map(sanitizeField),
  };
}

function defaultTemplate(
  kind: IntakeTemplate["kind"],
  defaultBranchId?: string,
): IntakeTemplate {
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
  defaultOversightRegion,
  defaultDistrict,
  readonly = false,
}: {
  template?: IntakeTemplate;
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  readonly?: boolean;
}) {
  const router = useRouter();
  const baseTemplate = template
    ? toEditableTemplate(template)
    : defaultTemplate("guest", defaultBranchId);
  const [draft, setDraft] = useState<IntakeTemplate>(baseTemplate);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [districtOverrideLoading, setDistrictOverrideLoading] = useState(false);
  const branchLabel = branches.find(
    (branch) => branch._id === draft.branchId,
  )?.name;
  const isDistrictVersion =
    !!template?._id && !!template.district && !!template.oversightRegion;
  const isGlobalBaseTemplate =
    !!template?._id &&
    !template.branchId &&
    !template.isBranchOverride &&
    !isDistrictVersion;
  const isBranchVersion =
    !!template?._id && (!!template.branchId || !!template.isBranchOverride);
  const canCreateBranchVersion =
    isGlobalBaseTemplate &&
    isBranchScopedRole(currentUserRole) &&
    !!defaultBranchId;
  const canCreateDistrictVersion =
    isGlobalBaseTemplate &&
    (isDistrictRole(currentUserRole) ||
      isNationalRole(currentUserRole) ||
      currentUserRole === "super_admin") &&
    !!defaultOversightRegion &&
    !!defaultDistrict;

  function updateDraft<K extends keyof IntakeTemplate>(
    key: K,
    value: IntakeTemplate[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateTheme(
    key:
      | "accentColor"
      | "darkColor"
      | "softColor"
      | "headerColor"
      | "headerTextColor"
      | "buttonTextColor",
    value: string,
  ) {
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
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
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
        spanish: draft.spanish,
        branchId: !isBranchScopedRole(currentUserRole)
          ? draft.branchId || undefined
          : defaultBranchId || undefined,
        oversightRegion: draft.oversightRegion || undefined,
        district: draft.district || undefined,
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
      if (!template?._id)
        router.push(createdHref("/templates?sort=newest", result, "Template"));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save template";
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
      const response = await fetch(
        `${API_URL}/intake-templates/${template._id}/branch-override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ branchId: defaultBranchId }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create branch version");
      }

      const message = "Branch version created.";
      setStatus(message);
      toast.success(message);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create branch version";
      setStatus(message);
      toast.error("Branch version unavailable", {
        description: message,
      });
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleCreateDistrictVersion() {
    if (!template?._id || !defaultOversightRegion || !defaultDistrict) {
      return;
    }

    setDistrictOverrideLoading(true);
    setStatus(null);

    try {
      const response = await fetch(
        `${API_URL}/intake-templates/${template._id}/district-override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            oversightRegion: defaultOversightRegion,
            district: defaultDistrict,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to create district version");
      }

      const message = "District version created.";
      setStatus(message);
      toast.success(message);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create district version";
      setStatus(message);
      toast.error("District version unavailable", {
        description: message,
      });
    } finally {
      setDistrictOverrideLoading(false);
    }
  }

  const checkRowClass =
    "flex min-h-[40px] items-center gap-2.5 rounded-xl border border-[#e4e3df] bg-white px-3 text-[14px] text-[#55534e]";
  const colorInputClass =
    "h-10 w-full cursor-pointer rounded-xl border border-[#e4e3df] bg-white px-1.5 py-1 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-4">
      {template?.shareUrl &&
      !(isGlobalBaseTemplate && canCreateBranchVersion) ? (
        <TemplateQrCard
          allowSpanish={draft.kind === "guest" || draft.kind === "member"}
          url={template.shareUrl}
          title={`${draft.name} share link`}
        />
      ) : null}
      {template ? (
        <section className="rounded-2xl bg-[#f6f5f1] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[14px] font-medium text-[#111111]">
                {isGlobalBaseTemplate
                  ? "Global base template"
                  : isDistrictVersion
                    ? "District version"
                    : isBranchVersion
                      ? "Branch version"
                      : "Template"}
              </p>
              <p className="mt-0.5 text-[13px] leading-[1.6] text-[#6b6b6b]">
                {isGlobalBaseTemplate
                  ? "This shared template stays centrally managed."
                  : isDistrictVersion
                    ? `This version applies to ${template?.district || "the selected district"}.`
                    : `This version only applies to ${branchLabel || "the selected branch"}.`}
              </p>
            </div>
            {isDistrictVersion && template?.district ? (
              <Badge tone="info">{template.district}</Badge>
            ) : null}
            {isBranchVersion && branchLabel ? (
              <Badge tone="info">{branchLabel}</Badge>
            ) : null}
          </div>
          {canCreateBranchVersion ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-[14px] text-[#55534e] md:flex-row md:items-center md:justify-between">
              <p>
                Start a branch version to customise this template for your
                branch.
              </p>
              <Button
                size="sm"
                onClick={handleCreateBranchVersion}
                disabled={overrideLoading}
              >
                {overrideLoading ? "Creating..." : "Create branch version"}
              </Button>
            </div>
          ) : null}
          {canCreateDistrictVersion ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-[14px] text-[#55534e] md:flex-row md:items-center md:justify-between">
              <p>
                Adopt this template for {defaultDistrict} so every branch in the
                district uses the district version.
              </p>
              <Button
                size="sm"
                onClick={handleCreateDistrictVersion}
                disabled={districtOverrideLoading}
              >
                {districtOverrideLoading
                  ? "Creating..."
                  : "Create district version"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
        <p className="text-[14px] font-medium text-[#111111]">Basics</p>
        <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
          Name, public link, form type and branch.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Template name">
            <input
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Template name"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Public link slug">
            <input
              value={draft.slug}
              onChange={(event) => updateDraft("slug", event.target.value)}
              placeholder="public-slug"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Form type">
            <select
              value={draft.kind}
              onChange={(event) =>
                resetForKind(event.target.value as IntakeTemplate["kind"])
              }
              disabled={readonly}
              className="ui-input"
            >
              <option value="guest">First timer</option>
              <option value="member">Member</option>
              <option value="attendance">Attendance summary</option>
              <option value="weekly_report">Weekly report</option>
              <option value="maag_report">MAAG monthly report</option>
            </select>
          </Field>
          <Field label="Branch">
            {!isBranchScopedRole(currentUserRole) ? (
              <select
                value={draft.branchId || ""}
                onChange={(event) =>
                  updateDraft("branchId", event.target.value || undefined)
                }
                disabled={readonly}
                className="ui-input"
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
                className="ui-input !bg-[#f6f5f1] !text-[#8a8780]"
              />
            )}
          </Field>
          <Field label="Badge">
            <input
              value={draft.badge || ""}
              onChange={(event) => updateDraft("badge", event.target.value)}
              placeholder="Short label above the title"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <label className={`${checkRowClass} self-end`}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                updateDraft("isActive", event.target.checked)
              }
              disabled={readonly}
              className="h-4 w-4 accent-[#111111]"
            />
            Active public template
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
        <p className="text-[14px] font-medium text-[#111111]">
          Public page wording
        </p>
        <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
          What visitors read before and after they submit.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Public title" className="sm:col-span-2">
            <input
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="Public title"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Subtitle" className="sm:col-span-2">
            <input
              value={draft.subtitle || ""}
              onChange={(event) => updateDraft("subtitle", event.target.value)}
              placeholder="Public subtitle"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Intro title" className="sm:col-span-2">
            <input
              value={draft.introTitle || ""}
              onChange={(event) =>
                updateDraft("introTitle", event.target.value)
              }
              placeholder="Intro title"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Intro text" className="sm:col-span-2">
            <textarea
              value={draft.introBody || ""}
              onChange={(event) => updateDraft("introBody", event.target.value)}
              placeholder="Intro body"
              disabled={readonly}
              className="ui-input !min-h-24"
            />
          </Field>
          <Field label="Closing text" className="sm:col-span-2">
            <textarea
              value={draft.closingText || ""}
              onChange={(event) =>
                updateDraft("closingText", event.target.value)
              }
              placeholder="Closing text"
              disabled={readonly}
              className="ui-input !min-h-20"
            />
          </Field>
          <Field label="Submit button label">
            <input
              value={draft.submitLabel || ""}
              onChange={(event) =>
                updateDraft("submitLabel", event.target.value)
              }
              placeholder="Submit label"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Logo path">
            <input
              value={draft.logoPath || ""}
              onChange={(event) => updateDraft("logoPath", event.target.value)}
              placeholder="/logo.png"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Success title">
            <input
              value={draft.successTitle || ""}
              onChange={(event) =>
                updateDraft("successTitle", event.target.value)
              }
              placeholder="Success title"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
          <Field label="Success message">
            <input
              value={draft.successMessage || ""}
              onChange={(event) =>
                updateDraft("successMessage", event.target.value)
              }
              placeholder="Success message"
              disabled={readonly}
              className="ui-input"
            />
          </Field>
        </div>

        {(draft.kind === "guest" || draft.kind === "member") && (
          <details className="mt-5 rounded-xl border border-black/[0.06] p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Optional Spanish wording
            </summary>
            <p className="mt-2 text-xs text-[#8a8780]">
              Standard labels are translated automatically. Add Spanish wording
              here for your custom introduction and confirmation. Church names
              stay unchanged unless you provide a translated title.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  "title",
                  "subtitle",
                  "introTitle",
                  "introBody",
                  "closingText",
                  "submitLabel",
                  "successTitle",
                  "successMessage",
                ] as const
              ).map((key) => (
                <Field
                  key={key}
                  label={`${key.replace(/([A-Z])/g, " $1")} (Spanish)`}
                >
                  <textarea
                    className="ui-input"
                    rows={2}
                    disabled={readonly}
                    value={draft.spanish?.[key] || ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        spanish: {
                          ...current.spanish,
                          [key]: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          </details>
        )}
        <p className="mt-6 text-[13px] font-medium text-[#6b6b6b]">
          Theme colours
        </p>
        <div className="mt-3 rounded-xl border border-black/[0.06] p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!draft.theme?.headerColor}
              disabled={readonly}
              onChange={(event) =>
                updateTheme(
                  "headerColor",
                  event.target.checked ? "#111111" : "",
                )
              }
            />{" "}
            Customize header color
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Header background color"
              value={draft.theme?.headerColor || "#ffffff"}
              disabled={readonly || !draft.theme?.headerColor}
              onChange={(event) =>
                updateTheme("headerColor", event.target.value)
              }
              className={colorInputClass}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={readonly}
              onClick={() => updateTheme("headerColor", "")}
            >
              Use default header
            </Button>
          </div>

          {(["headerTextColor", "buttonTextColor"] as const).map((key) => (
            <label
              key={key}
              className="mt-3 flex flex-wrap items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                disabled={readonly}
                checked={!!draft.theme?.[key]}
                onChange={(event) =>
                  updateTheme(
                    key,
                    event.target.checked
                      ? key === "headerTextColor"
                        ? formTextColor(draft.theme?.headerColor || "#ffffff")
                        : "#ffffff"
                      : "",
                  )
                }
              />
              {key === "headerTextColor"
                ? "Customize header text"
                : "Customize button text"}
              <input
                type="color"
                aria-label={
                  key === "headerTextColor"
                    ? "Header text color"
                    : "Button text color"
                }
                disabled={readonly || !draft.theme?.[key]}
                value={
                  draft.theme?.[key] ||
                  (key === "headerTextColor"
                    ? formTextColor(draft.theme?.headerColor || "#ffffff")
                    : "#ffffff")
                }
                onChange={(event) => updateTheme(key, event.target.value)}
              />
            </label>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={readonly}
            onClick={() => {
              updateTheme("headerTextColor", "");
              updateTheme("buttonTextColor", "");
            }}
          >
            Use automatic text colors
          </Button>
          <div
            className="mt-3 rounded-xl p-4 text-sm font-medium"
            style={{
              backgroundColor: draft.theme?.headerColor || "#ffffff",
              color:
                draft.theme?.headerTextColor ||
                formTextColor(draft.theme?.headerColor || "#ffffff"),
            }}
          >
            Header preview — {draft.name || "Your church form"}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Field label="Accent / buttons">
            <input
              type="color"
              value={draft.theme?.accentColor || "#dc2626"}
              onChange={(event) =>
                updateTheme("accentColor", event.target.value)
              }
              disabled={readonly}
              className={colorInputClass}
            />
          </Field>
          <Field label="Dark">
            <input
              type="color"
              value={draft.theme?.darkColor || "#111827"}
              onChange={(event) => updateTheme("darkColor", event.target.value)}
              disabled={readonly}
              className={colorInputClass}
            />
          </Field>
          <Field label="Soft">
            <input
              type="color"
              value={draft.theme?.softColor || "#fff7ed"}
              onChange={(event) => updateTheme("softColor", event.target.value)}
              disabled={readonly}
              className={colorInputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium text-[#111111]">
              Form fields{" "}
              <span className="ml-1 text-[#8a8780] tabular-nums">
                {draft.fields.length}
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-[#6b6b6b]">
              Edit labels, field types, options and required rules.
            </p>
          </div>
          {!readonly ? (
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              onClick={addField}
            >
              Add field
            </Button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {draft.fields.map((field, index) => (
            <div
              key={`${field.key}-${index}`}
              className="rounded-2xl bg-[#f6f5f1] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-[#111111]">
                  <span className="mr-1.5 text-[#8a8780] tabular-nums">
                    {index + 1}.
                  </span>
                  {field.label || "Untitled field"}
                </p>
                {!readonly ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => removeField(index)}
                  >
                    Remove field
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label">
                  <input
                    value={field.label}
                    onChange={(event) =>
                      updateField(index, { label: event.target.value })
                    }
                    disabled={readonly}
                    placeholder="Field label"
                    className="ui-input"
                  />
                </Field>
                <Field label="Key">
                  <input
                    value={field.key}
                    onChange={(event) =>
                      updateField(index, { key: event.target.value })
                    }
                    disabled={readonly}
                    placeholder="field_key"
                    className="ui-input"
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateField(index, { type: event.target.value })
                    }
                    disabled={readonly}
                    className="ui-input"
                  >
                    {fieldTypes.map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {fieldType}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Width">
                  <select
                    value={field.width || "half"}
                    onChange={(event) =>
                      updateField(index, { width: event.target.value })
                    }
                    disabled={readonly}
                    className="ui-input"
                  >
                    <option value="half">Half width</option>
                    <option value="full">Full width</option>
                  </select>
                </Field>
                <Field label="Placeholder">
                  <input
                    value={field.placeholder || ""}
                    onChange={(event) =>
                      updateField(index, { placeholder: event.target.value })
                    }
                    disabled={readonly}
                    placeholder="Placeholder"
                    className="ui-input"
                  />
                </Field>
                <Field label="Default value">
                  <input
                    value={field.defaultValue || ""}
                    onChange={(event) =>
                      updateField(index, { defaultValue: event.target.value })
                    }
                    disabled={readonly}
                    placeholder="Default value"
                    className="ui-input"
                  />
                </Field>
                <label className={`${checkRowClass} sm:col-span-2`}>
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={(event) =>
                      updateField(index, { required: event.target.checked })
                    }
                    disabled={readonly}
                    className="h-4 w-4 accent-[#111111]"
                  />
                  Required field
                </label>
                <Field label="Helper text" className="sm:col-span-2">
                  <textarea
                    value={field.helpText || ""}
                    onChange={(event) =>
                      updateField(index, { helpText: event.target.value })
                    }
                    disabled={readonly}
                    placeholder="Helper text"
                    className="ui-input !min-h-20"
                  />
                </Field>
                <details className="mt-3 rounded-xl bg-[#f6f5f1] p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Spanish field wording (optional)
                  </summary>
                  <div className="mt-3 grid gap-3">
                    {(["labelEs", "placeholderEs", "helpTextEs"] as const).map(
                      (key) => (
                        <Field
                          key={key}
                          label={
                            key === "labelEs"
                              ? "Spanish label"
                              : key === "placeholderEs"
                                ? "Spanish placeholder"
                                : "Spanish help text"
                          }
                        >
                          <input
                            className="ui-input"
                            disabled={readonly}
                            value={field[key] || ""}
                            onChange={(event) =>
                              updateField(index, { [key]: event.target.value })
                            }
                          />
                        </Field>
                      ),
                    )}
                  </div>
                  {["radio", "select", "checkbox"].includes(field.type) && (
                    <Field label="Spanish option labels (one per line, in the same order as the English options)">
                      <textarea
                        className="ui-input"
                        rows={3}
                        disabled={readonly}
                        value={(field.optionsEs || []).join("\n")}
                        onChange={(event) =>
                          updateField(index, {
                            optionsEs: event.target.value.split("\n"),
                          })
                        }
                      />
                    </Field>
                  )}
                </details>
                {field.type === "select" ||
                field.type === "radio" ||
                field.type === "checkbox" ? (
                  <Field
                    label="Options"
                    hint="Separate options with commas."
                    className="sm:col-span-2"
                  >
                    <input
                      value={(field.options || []).join(", ")}
                      onChange={(event) =>
                        updateField(index, {
                          options: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                      disabled={readonly}
                      placeholder="Option 1, Option 2, Option 3"
                      className="ui-input"
                    />
                  </Field>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {!readonly ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Saving..."
              : template?._id
                ? "Update template"
                : "Create template"}
          </Button>
          {status ? (
            <p className="text-[13px] text-[#6b6b6b]">{status}</p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-[#f6f5f1] px-4 py-3 text-[13px] leading-[1.6] text-[#6b6b6b]">
          {canCreateBranchVersion
            ? "This shared template stays locked at the global level. Create a branch version to make local changes."
            : "This shared template is locked at the global level."}
        </p>
      )}
    </div>
  );
}
