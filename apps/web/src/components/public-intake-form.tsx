"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import type { IntakeTemplate } from "@/lib/types";

type IntakeAnswerValue = string | string[];
type IntakeStep = {
  key: string;
  title: string;
  description: string;
  fields: IntakeTemplate["fields"];
};

function getInputType(type: string) {
  if (["email", "tel", "date", "number"].includes(type)) {
    return type;
  }

  return "text";
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeMatchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function createInitialAnswers(fields: IntakeTemplate["fields"]) {
  const initialAnswers: Record<string, IntakeAnswerValue> = {};

  for (const field of fields) {
    initialAnswers[field.key] = field.type === "checkbox" ? [] : "";
  }

  return initialAnswers;
}

function getStringValue(value: IntakeAnswerValue | undefined) {
  return Array.isArray(value) ? "" : value || "";
}

function getArrayValue(value: IntakeAnswerValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function isAnswerMissing(field: IntakeTemplate["fields"][number], value: IntakeAnswerValue | undefined) {
  if (!field.required) {
    return false;
  }

  if (field.type === "checkbox") {
    return getArrayValue(value).length === 0;
  }

  return getStringValue(value).trim().length === 0;
}

function getFieldValidationMessage(
  field: IntakeTemplate["fields"][number],
  value: IntakeAnswerValue | undefined,
) {
  if (isAnswerMissing(field, value)) {
    return `${field.label} is required before you continue.`;
  }

  if (field.type === "checkbox") {
    const selected = getArrayValue(value);

    if (
      selected.length > 0 &&
      (field.options || []).length > 0 &&
      selected.some((item) => !(field.options || []).includes(item))
    ) {
      return `${field.label} contains an invalid option.`;
    }

    return null;
  }

  const textValue = getStringValue(value).trim();

  if (!textValue) {
    return null;
  }

  if (field.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
      return `${field.label} must be a valid date.`;
    }

    if (textValue > getTodayDateString()) {
      return `${field.label} cannot be in the future.`;
    }
  }

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textValue)) {
    return `${field.label} must be a valid email address.`;
  }

  if (field.type === "tel") {
    const digits = textValue.replace(/\D/g, "");

    if (digits.length < 7 || digits.length > 15) {
      return `${field.label} must be a valid phone number.`;
    }
  }

  if (field.type === "number") {
    const parsed = Number(textValue);

    if (Number.isNaN(parsed)) {
      return `${field.label} must be a valid number.`;
    }

    if (parsed < 0) {
      return `${field.label} cannot be negative.`;
    }
  }

  if (
    (field.type === "radio" || field.type === "select") &&
    (field.options || []).length > 0 &&
    !(field.options || []).includes(textValue)
  ) {
    return `${field.label} contains an invalid option.`;
  }

  return null;
}

function validateFields(
  fields: IntakeTemplate["fields"],
  answers: Record<string, IntakeAnswerValue>,
) {
  for (const field of fields) {
    const message = getFieldValidationMessage(field, answers[field.key]);

    if (message) {
      return message;
    }
  }

  return null;
}

function formatAnswerForReview(
  field: IntakeTemplate["fields"][number],
  value: IntakeAnswerValue | undefined,
) {
  if (field.type === "checkbox") {
    const items = getArrayValue(value);
    return items.length > 0 ? items.join(", ") : "Not provided";
  }

  const text = getStringValue(value).trim();
  return text || "Not provided";
}

function collectAnswersFromForm(
  form: HTMLFormElement,
  fields: IntakeTemplate["fields"],
  currentAnswers: Record<string, IntakeAnswerValue>,
) {
  const formData = new FormData(form);
  const nextAnswers: Record<string, IntakeAnswerValue> = { ...currentAnswers };

  for (const field of fields) {
    if (field.type === "checkbox") {
      if (formData.has(field.key)) {
        nextAnswers[field.key] = formData.getAll(field.key).map((value) => String(value));
      }
      continue;
    }

    if (formData.has(field.key)) {
      nextAnswers[field.key] = String(formData.get(field.key) ?? "");
    }
  }

  return nextAnswers;
}

function getStepBlueprints(kind: IntakeTemplate["kind"]) {
  if (kind === "guest") {
    return [
      {
        key: "welcome",
        title: "Welcome",
        description: "Tell us who you are and the basics of this visit.",
        matches: (value: string) =>
          matchesAny(value, ["visitdate", "servicedate", "firstname", "lastname", "gender"]),
      },
      {
        key: "contact",
        title: "Contact",
        description: "How can the church reach and locate you well?",
        matches: (value: string) =>
          matchesAny(value, ["email", "phone", "address", "street", "city", "state", "zipcode", "zip"]),
      },
      {
        key: "followup",
        title: "Follow-up",
        description: "Help us understand your family context and next-care needs.",
        matches: () => true,
      },
    ];
  }

  if (kind === "member") {
    return [
      {
        key: "identity",
        title: "Identity",
        description: "Capture the member's core record and joining details.",
        matches: (value: string) =>
          matchesAny(value, ["datejoinedchurch", "joined", "firstname", "lastname", "membershipstatus"]),
      },
      {
        key: "contact",
        title: "Contact",
        description: "Keep communication and household details up to date.",
        matches: (value: string) =>
          matchesAny(value, ["email", "phone", "address", "street", "city", "state", "zip", "family"]),
      },
      {
        key: "schooling",
        title: "Bible School",
        description: "Track BFC, BCC, LCC, and LCD attendance with date and location.",
        matches: (value: string) =>
          matchesAny(value, [
            "believerfoundationclass",
            "bcc",
            "lcc",
            "lcd",
            "location",
            "dateoryear",
          ]),
      },
      {
        key: "service",
        title: "Service & Baptism",
        description: "Capture service-unit placement and baptism milestones.",
        matches: () => true,
      },
    ];
  }

  return [
    {
      key: "service",
      title: "Service details",
      description: "Record when and which service this attendance belongs to.",
      matches: (value: string) =>
        matchesAny(value, ["servicedate", "servicetype", "servicename", "dayofservice"]),
    },
    {
      key: "counts",
      title: "Attendance counts",
      description: "Enter the core attendance numbers for the service.",
      matches: (value: string) =>
        matchesAny(value, [
          "mencount",
          "womencount",
          "childrencount",
          "adultscount",
          "firsttimerscount",
          "newconvertscount",
          "holyspiritbaptismcount",
        ]),
    },
    {
      key: "extras",
      title: "Final details",
      description: "Review any extra reporting fields before submission.",
      matches: () => true,
    },
  ];
}

function buildTemplateSteps(template: IntakeTemplate): IntakeStep[] {
  const blueprints = getStepBlueprints(template.kind).map((step) => ({
    ...step,
    fields: [] as IntakeTemplate["fields"],
  }));

  const fallbackIndex = blueprints.length - 1;

  for (const field of template.fields) {
    const matchValue = normalizeMatchValue(`${field.key} ${field.label}`);
    const stepIndex = blueprints.findIndex((step) => step.matches(matchValue));
    blueprints[stepIndex >= 0 ? stepIndex : fallbackIndex].fields.push(field);
  }

  const steps = blueprints
    .filter((step) => step.fields.length > 0)
    .map(({ key, title, description, fields }) => ({
      key,
      title,
      description,
      fields,
    }));

  return [
    ...steps,
    {
      key: "review",
      title: "Review & submit",
      description: "Confirm the details before you send this intake.",
      fields: [],
    },
  ];
}

export function PublicIntakeForm({
  template,
  branchId,
}: {
  template: IntakeTemplate;
  branchId?: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [answers, setAnswers] = useState<Record<string, IntakeAnswerValue>>(() =>
    createInitialAnswers(template.fields),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const steps = buildTemplateSteps(template);
  const currentStep = steps[stepIndex];
  const accentColor = template.theme?.accentColor || "#dc2626";
  const darkColor = template.theme?.darkColor || "#111827";
  const softColor = template.theme?.softColor || "#fff7ed";

  function updateAnswer(key: string, value: IntakeAnswerValue) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
    }));
    setStatus(null);
    setStepError(null);
  }

  function toggleCheckbox(key: string, option: string, checked: boolean) {
    const currentValues = getArrayValue(answers[key]);

    if (checked) {
      updateAnswer(key, [...currentValues, option]);
      return;
    }

    updateAnswer(
      key,
      currentValues.filter((value) => value !== option),
    );
  }

  function parseStepMessage(targetStepIndex: number) {
    const currentAnswers = formRef.current
      ? collectAnswersFromForm(formRef.current, template.fields, answers)
      : answers;
    const message = validateFields(steps[targetStepIndex]?.fields || [], currentAnswers);

    if (formRef.current) {
      setAnswers(currentAnswers);
    }

    if (!message) {
      return null;
    }

    setStepError(message);
    toast.error("Complete this step first", {
      description: message,
    });
    return message;
  }

  function goToStep(targetStepIndex: number) {
    if (targetStepIndex <= stepIndex) {
      setStepIndex(targetStepIndex);
      setStepError(null);
      return;
    }

    for (let index = stepIndex; index < targetStepIndex; index += 1) {
      if (parseStepMessage(index)) {
        return;
      }
    }

    setStepError(null);
    setStepIndex(targetStepIndex);
  }

  function handleNextStep() {
    if (parseStepMessage(stepIndex)) {
      return;
    }

    setStepError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submitIntake() {
    const nextAnswers = formRef.current
      ? collectAnswersFromForm(formRef.current, template.fields, answers)
      : answers;
    setAnswers(nextAnswers);

    const invalidStepIndex = steps.findIndex(
      (step) => step.fields.length > 0 && validateFields(step.fields, nextAnswers),
    );

    if (invalidStepIndex >= 0) {
      const message = validateFields(steps[invalidStepIndex].fields, nextAnswers);
      setStepIndex(invalidStepIndex);
      setStepError(message);
      toast.error("Complete the required fields", {
        description: message || "Please finish the highlighted step before submitting.",
      });
      return;
    }

    setLoading(true);
    setStatus(null);
    setStepError(null);
    setSuccess(null);

    const loadingToast = toast.loading("Submitting your intake form...");

    try {
      const submissionQuery = branchId
        ? `?branchId=${encodeURIComponent(branchId)}`
        : "";
      const response = await fetch(
        `${API_URL}/intake-templates/public/${template.slug}/submit${submissionQuery}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
        },
      );

      const result = response.headers.get("content-type")?.includes("application/json")
        ? ((await response.json()) as {
            successTitle?: string;
            successMessage?: string;
            message?: string | string[];
          })
        : null;

      if (!response.ok) {
        const message = Array.isArray(result?.message)
          ? result?.message[0]
          : result?.message || "Unable to submit form";
        throw new Error(message);
      }

      const successTitle = result?.successTitle || template.successTitle || "Thank you";
      const successMessage =
        result?.successMessage || template.successMessage || "Your submission has been received.";

      setSuccess({
        title: successTitle,
        message: successMessage,
      });
      toast.success(successTitle || "Form submitted", {
        id: loadingToast,
        description: successMessage,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit form";
      setStatus(message);
      toast.error("Submission failed", {
        id: loadingToast,
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(circle at top left, ${softColor}, white 45%, #f8fafc 100%)`,
      }}
    >
      <div className="mx-auto grid min-h-screen max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:px-6 lg:py-10">
        <section
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
          style={{ borderTop: `8px solid ${accentColor}` }}
        >
          <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                <Image
                  src={template.logoPath || "/logo.png"}
                  alt={template.title}
                  width={64}
                  height={64}
                  className="h-16 w-auto object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                  {template.badge || `${template.kind} intake`}
                </p>
                <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-950">{template.title}</h1>
                {template.subtitle ? <p className="mt-1.5 text-sm text-slate-500">{template.subtitle}</p> : null}
              </div>
            </div>
          </div>
          <div className="px-5 py-6 sm:px-7">
            <div className="rounded-[22px] px-4 py-4 text-sm leading-7 text-slate-700" style={{ backgroundColor: softColor }}>
              {template.introTitle ? <p className="text-base font-semibold text-slate-950">{template.introTitle}</p> : null}
              {template.introBody ? <p className="mt-2 whitespace-pre-line">{template.introBody}</p> : null}
              {template.closingText ? <p className="mt-4 font-semibold">{template.closingText}</p> : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Step-by-step flow", "Secure submission", "Follow-up ready"].map((item) => (
                <div key={item} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: accentColor }}>
                  {template.name}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Complete the intake one short step at a time.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                Step {stepIndex + 1} of {steps.length}
              </div>
            </div>
          </div>

          {success ? (
            <div className="px-5 py-10 sm:px-7">
              <div
                className="rounded-[24px] px-5 py-6 text-white"
                style={{ background: `linear-gradient(135deg, ${darkColor}, ${accentColor})` }}
              >
                <p className="text-2xl font-semibold">{success.title}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-white/85">{success.message}</p>
              </div>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
              }}
              noValidate
              className="px-5 py-6 sm:px-7"
            >
              <div className="mb-6 flex flex-wrap gap-2">
                {steps.map((step, index) => {
                  const isCurrent = index === stepIndex;
                  const isComplete = index < stepIndex;

                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => goToStep(index)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        isCurrent
                          ? "border-slate-950 bg-slate-950 text-white"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {index + 1}. {step.title}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5">
                <p className="text-lg font-semibold text-slate-950">{currentStep.title}</p>
                <p className="mt-1 text-sm text-slate-500">{currentStep.description}</p>
              </div>

              {currentStep.fields.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {currentStep.fields.map((field) => {
                    const colSpan = field.width === "full" ? "md:col-span-2" : "";

                    if (field.type === "textarea") {
                      return (
                        <label key={field.key} className={`space-y-2 ${colSpan}`}>
                          <span className="text-sm font-semibold text-slate-900">
                            {field.label}
                            {field.required ? " *" : ""}
                          </span>
                          {field.helpText ? <span className="block text-xs text-slate-500">{field.helpText}</span> : null}
                          <textarea
                            name={field.key}
                            value={getStringValue(answers[field.key])}
                            onChange={(event) => updateAnswer(field.key, event.target.value)}
                            required={field.required}
                            placeholder={field.placeholder}
                            className="min-h-28 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                      );
                    }

                    if (field.type === "radio") {
                      return (
                        <fieldset key={field.key} className={`space-y-2 ${colSpan}`}>
                          <legend className="text-sm font-semibold text-slate-900">
                            {field.label}
                            {field.required ? " *" : ""}
                          </legend>
                          {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
                          <div className="space-y-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                            {(field.options || []).map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="radio"
                                  name={field.key}
                                  value={option}
                                  checked={getStringValue(answers[field.key]) === option}
                                  onChange={(event) => updateAnswer(field.key, event.target.value)}
                                  required={field.required}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    }

                    if (field.type === "checkbox") {
                      return (
                        <fieldset key={field.key} className={`space-y-2 ${colSpan}`}>
                          <legend className="text-sm font-semibold text-slate-900">
                            {field.label}
                            {field.required ? " *" : ""}
                          </legend>
                          {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
                          <div className="space-y-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                            {(field.options || []).map((option) => (
                              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  name={field.key}
                                  value={option}
                                  checked={getArrayValue(answers[field.key]).includes(option)}
                                  onChange={(event) => toggleCheckbox(field.key, option, event.target.checked)}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      );
                    }

                    if (field.type === "select") {
                      return (
                        <label key={field.key} className={`space-y-2 ${colSpan}`}>
                          <span className="text-sm font-semibold text-slate-900">
                            {field.label}
                            {field.required ? " *" : ""}
                          </span>
                          <select
                            name={field.key}
                            value={getStringValue(answers[field.key])}
                            onChange={(event) => updateAnswer(field.key, event.target.value)}
                            required={field.required}
                            className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          >
                            <option value="">{field.placeholder || "Select an option"}</option>
                            {(field.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }

                    return (
                      <label key={field.key} className={`space-y-2 ${colSpan}`}>
                        <span className="text-sm font-semibold text-slate-900">
                          {field.label}
                          {field.required ? " *" : ""}
                        </span>
                        {field.helpText ? <span className="block text-xs text-slate-500">{field.helpText}</span> : null}
                        <input
                          name={field.key}
                          type={getInputType(field.type)}
                          value={getStringValue(answers[field.key])}
                          onChange={(event) => updateAnswer(field.key, event.target.value)}
                          required={field.required}
                          placeholder={field.placeholder}
                          max={field.type === "date" ? getTodayDateString() : undefined}
                          min={field.type === "number" ? "0" : undefined}
                          step={field.type === "number" ? "1" : undefined}
                          className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {steps
                    .filter((step) => step.fields.length > 0)
                    .map((step) => (
                      <div key={step.key} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {step.fields.map((field) => (
                            <div key={field.key} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                {field.label}
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                {formatAnswerForReview(field, answers[field.key])}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {stepError ? <p className="mt-4 text-sm text-rose-600">{stepError}</p> : null}
              {status ? <p className="mt-4 text-sm text-rose-600">{status}</p> : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setStepIndex((current) => Math.max(current - 1, 0));
                    }}
                    className="rounded-[18px] border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                  >
                    Back
                  </button>
                ) : null}

                {stepIndex < steps.length - 1 ? (
                  <button
                    key={`continue-${stepIndex}`}
                    type="button"
                    onClick={handleNextStep}
                    className="rounded-[18px] px-5 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    key="submit-intake"
                    type="button"
                    onClick={() => {
                      void submitIntake();
                    }}
                    disabled={loading}
                    className="rounded-[18px] px-5 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {loading ? "Submitting..." : template.submitLabel || "Submit form"}
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
