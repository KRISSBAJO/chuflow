"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Alert, Spinner } from "@/components/auth/auth-ui";
import { Wordmark } from "@/components/brand/wordmark";
import { API_URL } from "@/lib/api";
import type { IntakeTemplate, PublicBranchOption } from "@/lib/types";

type IntakeAnswerValue = string | string[];
type IntakeStep = {
  key: string;
  title: string;
  description: string;
  fields: IntakeTemplate["fields"];
};

function getInputType(type: string) {
  if (["email", "tel", "date", "month", "number"].includes(type)) {
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
    initialAnswers[field.key] = field.type === "checkbox" ? [] : field.defaultValue || "";
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

function getWeeklyGrowthPreview(answers: Record<string, IntakeAnswerValue>) {
  const currentValue = getStringValue(answers.currentAttendance).trim();
  const previousValue = getStringValue(answers.previousAttendance).trim();

  if (!currentValue || !previousValue) {
    return null;
  }

  const currentAttendance = Number(currentValue);
  const previousAttendance = Number(previousValue);

  if (Number.isNaN(currentAttendance) || Number.isNaN(previousAttendance)) {
    return null;
  }

  const growth = currentAttendance - previousAttendance;
  const growthPercent =
    previousAttendance > 0 ? Number(((growth / previousAttendance) * 100).toFixed(2)) : 0;

  return {
    currentAttendance,
    previousAttendance,
    growth,
    growthPercent,
  };
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

  if (kind === "weekly_report") {
    return [
      {
        key: "week",
        title: "Report week",
        description: "Confirm the branch reporting week and attendance movement.",
        matches: (value: string) =>
          matchesAny(value, [
            "reportweek",
            "currentattendance",
            "previousattendance",
            "growth",
            "averagelastyear",
            "averagelastperiod",
          ]),
      },
      {
        key: "spiritual",
        title: "Spiritual indices",
        description: "Enter first timers, new converts, foundation class, baptism, CHOP, and WSF figures.",
        matches: (value: string) =>
          matchesAny(value, [
            "firsttimers",
            "newconverts",
            "believersfoundation",
            "holyghost",
            "holyspirit",
            "waterbaptism",
            "covenanthour",
            "satellitefellowship",
          ]),
      },
      {
        key: "cells",
        title: "Cells & remarks",
        description: "Capture cell growth, WOFBI, and any branch remarks for district review.",
        matches: () => true,
      },
    ];
  }

  if (kind === "maag_report") {
    return [
      {
        key: "station",
        title: "Station details",
        description: "Confirm the month, nation, station, facility type, and station leadership.",
        matches: (value: string) =>
          matchesAny(value, ["reportmonth", "nation", "station", "facilitytype", "designation"]),
      },
      {
        key: "facilities",
        title: "Facilities",
        description: "Enter auditorium, overflow, youth, and children facility capacities.",
        matches: (value: string) =>
          matchesAny(value, ["hallcapacity", "chairs", "overflow", "youth", "childrenfacility", "mainauditorium"]),
      },
      {
        key: "attendance",
        title: "Attendance",
        description: "Record services, average attendance, highest attendance, adult, children, and CHOP figures.",
        matches: (value: string) =>
          matchesAny(value, ["servicescount", "attendance", "adult", "children", "chop"]),
      },
      {
        key: "finance",
        title: "Finance",
        description: "Capture income, ROF, and expense values for the month.",
        matches: (value: string) =>
          matchesAny(value, ["income", "rof", "expense"]),
      },
      {
        key: "indices",
        title: "Spiritual indices",
        description: "Capture WSF, first timers, WOFBI, new converts, foundation class, and baptisms.",
        matches: (value: string) =>
          matchesAny(value, ["wsf", "firsttimers", "wofbi", "newconverts", "foundation", "baptism"]),
      },
      {
        key: "pastor",
        title: "Pastor details",
        description: "Record pastor contact, family, nationality, enlistment, resumption, and station remarks.",
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
  branchOptions = [],
  defaultOversightRegion,
  defaultDistrict,
}: {
  template: IntakeTemplate;
  branchId?: string;
  branchOptions?: PublicBranchOption[];
  defaultOversightRegion?: string;
  defaultDistrict?: string;
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
  const [selectedOversightRegion, setSelectedOversightRegion] = useState(defaultOversightRegion || "");
  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict || "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId || template.branchId || "");

  const steps = buildTemplateSteps(template);
  const currentStep = steps[stepIndex];
  const accentColor = template.theme?.accentColor || "#dc2626";
  const softColor = template.theme?.softColor || "#fff7ed";
  const submissionBranchId = template.branchId || branchId || selectedBranchId;
  const weeklyGrowthPreview =
    template.kind === "weekly_report" ? getWeeklyGrowthPreview(answers) : null;
  const needsBranchSelection =
    (template.kind === "weekly_report" || template.kind === "maag_report") &&
    !template.branchId &&
    !branchId;
  const oversightRegions = Array.from(new Set(branchOptions.map((branch) => branch.oversightRegion).filter(Boolean))).sort();
  const districtOptions = Array.from(
    new Set(
      branchOptions
        .filter((branch) => !selectedOversightRegion || branch.oversightRegion === selectedOversightRegion)
        .map((branch) => branch.district)
        .filter(Boolean),
    ),
  ).sort();
  const visibleBranchOptions = branchOptions.filter(
    (branch) =>
      (!selectedOversightRegion || branch.oversightRegion === selectedOversightRegion) &&
      (!selectedDistrict || branch.district === selectedDistrict),
  );

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
      if (needsBranchSelection && !submissionBranchId) {
        throw new Error("Please choose the branch this weekly report belongs to.");
      }

      const submissionQuery = submissionBranchId
        ? `?branchId=${encodeURIComponent(submissionBranchId)}`
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

  const progress = success ? 100 : ((stepIndex + 1) / steps.length) * 100;
  const fieldLabel = (field: IntakeTemplate["fields"][number]) => (
    <span className="mb-2 block text-[14px] font-medium text-[var(--lp-ink)]">
      {field.label}
      {field.required ? <span style={{ color: accentColor }}> *</span> : null}
    </span>
  );
  const fieldHelp = (field: IntakeTemplate["fields"][number]) =>
    field.helpText ? <span className="-mt-1 mb-2 block text-[13px] text-[var(--lp-muted)]">{field.helpText}</span> : null;
  const optionClass =
    "flex cursor-pointer items-center gap-3 rounded-[14px] border border-[#e4e3df] bg-white px-4 py-3 text-[15px] text-[var(--lp-ink)] transition-colors hover:border-[#cfcdc8] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]";

  return (
    <div
      className="lp-root lp-intake min-h-screen w-full bg-white"
      style={{ "--accent": accentColor, "--accent-soft": softColor } as CSSProperties}
    >
      <header className="flex h-20 items-center justify-between gap-4 px-5 sm:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--lp-panel)]">
            <Image
              src={template.logoPath || "/logo.png"}
              alt=""
              width={36}
              height={36}
              className="h-8 w-8 object-contain"
            />
          </span>
          <span className="truncate text-[15px] font-medium text-[var(--lp-ink)]">{template.name}</span>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[12px] text-[var(--lp-muted)]">
          <span className="hidden sm:inline">Powered by</span>
          <Wordmark size={15} />
        </span>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 pb-20 pt-6 sm:px-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:pt-12">
        <section className="lp-rise lg:sticky lg:top-10 lg:self-start">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-panel)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--lp-ink)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
            {template.badge || "Welcome"}
          </p>
          <h1 className="lp-heading mt-6 text-[2.5rem] leading-[1.04] sm:text-[3.25rem]">{template.title}</h1>
          {template.subtitle ? (
            <p className="mt-4 text-[17px] leading-[1.6] text-[var(--lp-muted)]">{template.subtitle}</p>
          ) : null}

          {template.introTitle || template.introBody || template.closingText ? (
            <div className="mt-8 rounded-[24px] bg-[var(--lp-panel)] p-6 text-[15px] leading-[1.7] text-[var(--lp-ink)]">
              {template.introTitle ? <p className="text-[16px] font-semibold">{template.introTitle}</p> : null}
              {template.introBody ? (
                <p className="mt-2 whitespace-pre-line text-[var(--lp-muted)]">{template.introBody}</p>
              ) : null}
              {template.closingText ? <p className="mt-4 font-medium">{template.closingText}</p> : null}
            </div>
          ) : null}

          <ul className="mt-8 hidden space-y-3 lg:block">
            {["A few short steps", "Your details stay private", "Ready for a warm follow-up"].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-[var(--lp-muted)]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: accentColor }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="lp-rise overflow-hidden rounded-[32px] border border-black/[0.06] bg-white shadow-[0_40px_90px_-50px_rgba(17,17,17,0.35)]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="h-1 bg-[var(--lp-panel)]">
            <div
              className="h-full rounded-r-full transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>

          {success ? (
            <div className="lp-rise px-6 py-20 text-center sm:px-12">
              <span
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: accentColor, boxShadow: `0 20px 40px -18px ${accentColor}` }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <h2 className="lp-heading mt-8 text-[2.25rem] leading-[1.05]">{success.title}</h2>
              <p className="mx-auto mt-4 max-w-[440px] text-[16px] leading-[1.7] text-[var(--lp-muted)]">{success.message}</p>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
              }}
              noValidate
              className="px-6 py-8 sm:px-10 sm:py-10"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] font-medium text-[var(--lp-muted)]">
                  Step {stepIndex + 1} of {steps.length}
                </p>
                <div className="flex items-center gap-1.5">
                  {steps.map((step, index) => {
                    const isCurrent = index === stepIndex;
                    const isComplete = index < stepIndex;

                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => goToStep(index)}
                        aria-label={`Go to step ${index + 1}: ${step.title}`}
                        aria-current={isCurrent ? "step" : undefined}
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: isCurrent ? 28 : 8,
                          backgroundColor: isCurrent ? "var(--lp-ink)" : isComplete ? accentColor : "#e4e3df",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div key={stepIndex} className="lp-rise">
                <div className="mb-8 mt-6">
                  <h2 className="lp-heading text-[1.85rem] leading-[1.1]">{currentStep.title}</h2>
                  {currentStep.description ? (
                    <p className="mt-2 text-[15px] leading-[1.6] text-[var(--lp-muted)]">{currentStep.description}</p>
                  ) : null}
                </div>

                {needsBranchSelection ? (
                  <div className="mb-8 rounded-[24px] bg-[var(--lp-panel)] p-5">
                    <p className="text-[15px] font-medium text-[var(--lp-ink)]">Report scope</p>
                    <p className="mt-1 text-[13px] text-[var(--lp-muted)]">
                      Choose the district and branch this report belongs to before submitting.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-[13px] font-medium text-[var(--lp-ink)]">National area</span>
                        <select
                          value={selectedOversightRegion}
                          onChange={(event) => {
                            setSelectedOversightRegion(event.target.value);
                            setSelectedDistrict("");
                            setSelectedBranchId("");
                          }}
                          disabled={!!defaultOversightRegion}
                          className="lp-input disabled:bg-[#efeee9] disabled:text-[var(--lp-muted)]"
                        >
                          <option value="">Select area</option>
                          {oversightRegions.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[13px] font-medium text-[var(--lp-ink)]">District</span>
                        <select
                          value={selectedDistrict}
                          onChange={(event) => {
                            setSelectedDistrict(event.target.value);
                            setSelectedBranchId("");
                          }}
                          disabled={!!defaultDistrict}
                          className="lp-input disabled:bg-[#efeee9] disabled:text-[var(--lp-muted)]"
                        >
                          <option value="">Select district</option>
                          {districtOptions.map((district) => (
                            <option key={district} value={district}>
                              {district}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[13px] font-medium text-[var(--lp-ink)]">Branch</span>
                        <select
                          value={selectedBranchId}
                          onChange={(event) => setSelectedBranchId(event.target.value)}
                          className="lp-input"
                        >
                          <option value="">Select branch</option>
                          {visibleBranchOptions.map((branch) => (
                            <option key={branch._id} value={branch._id}>
                              {branch.name}
                              {branch.city || branch.state ? ` · ${[branch.city, branch.state].filter(Boolean).join(", ")}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {branchOptions.length === 0 ? (
                      <p className="mt-3 text-[13px] text-red-700">No active branches are available for this report link.</p>
                    ) : null}
                  </div>
                ) : null}

                {currentStep.fields.length > 0 ? (
                  <div className="grid gap-x-4 gap-y-6 md:grid-cols-2">
                    {currentStep.fields.map((field) => {
                      const colSpan = field.width === "full" ? "md:col-span-2" : "";

                      if (field.type === "textarea") {
                        return (
                          <label key={field.key} className={`block ${colSpan}`}>
                            {fieldLabel(field)}
                            {fieldHelp(field)}
                            <textarea
                              name={field.key}
                              value={getStringValue(answers[field.key])}
                              onChange={(event) => updateAnswer(field.key, event.target.value)}
                              required={field.required}
                              placeholder={field.placeholder}
                              className="lp-input"
                            />
                          </label>
                        );
                      }

                      if (field.type === "radio" || field.type === "checkbox") {
                        const isRadio = field.type === "radio";
                        return (
                          <fieldset key={field.key} className={colSpan}>
                            <legend className="contents">{fieldLabel(field)}</legend>
                            {fieldHelp(field)}
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(field.options || []).map((option) => (
                                <label key={option} className={optionClass}>
                                  <input
                                    type={field.type}
                                    name={field.key}
                                    value={option}
                                    checked={
                                      isRadio
                                        ? getStringValue(answers[field.key]) === option
                                        : getArrayValue(answers[field.key]).includes(option)
                                    }
                                    onChange={(event) =>
                                      isRadio
                                        ? updateAnswer(field.key, event.target.value)
                                        : toggleCheckbox(field.key, option, event.target.checked)
                                    }
                                    required={isRadio ? field.required : undefined}
                                    className="h-4 w-4 shrink-0"
                                    style={{ accentColor }}
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
                          <label key={field.key} className={`block ${colSpan}`}>
                            {fieldLabel(field)}
                            {fieldHelp(field)}
                            <select
                              name={field.key}
                              value={getStringValue(answers[field.key])}
                              onChange={(event) => updateAnswer(field.key, event.target.value)}
                              required={field.required}
                              className="lp-input"
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
                        <label key={field.key} className={`block ${colSpan}`}>
                          {fieldLabel(field)}
                          {fieldHelp(field)}
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
                            className="lp-input"
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps
                      .filter((step) => step.fields.length > 0)
                      .map((step) => (
                        <div key={step.key} className="rounded-[24px] bg-[var(--lp-panel)] p-5">
                          <p className="text-[15px] font-medium text-[var(--lp-ink)]">{step.title}</p>
                          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
                            {step.fields.map((field) => (
                              <div key={field.key}>
                                <dt className="text-[12px] text-[var(--lp-muted)]">{field.label}</dt>
                                <dd className="mt-0.5 text-[15px] text-[var(--lp-ink)]">
                                  {formatAnswerForReview(field, answers[field.key])}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                  </div>
                )}

                {weeklyGrowthPreview ? (
                  <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Current", weeklyGrowthPreview.currentAttendance],
                      ["Previous", weeklyGrowthPreview.previousAttendance],
                      ["Growth", weeklyGrowthPreview.growth],
                      ["Growth %", `${weeklyGrowthPreview.growthPercent > 0 ? "+" : ""}${weeklyGrowthPreview.growthPercent}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[18px] bg-[var(--lp-panel)] px-4 py-3">
                        <p className="text-[12px] text-[var(--lp-muted)]">{label}</p>
                        <p className="lp-heading mt-1 text-[22px]">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {stepError || status ? (
                <div className="mt-6">
                  <Alert tone="error">{stepError || status}</Alert>
                </div>
              ) : null}

              <div className="mt-10 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-6">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      setStepIndex((current) => Math.max(current - 1, 0));
                    }}
                    className="inline-flex h-12 items-center rounded-full bg-[var(--lp-panel)] px-6 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:bg-[#ecebe7]"
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}

                {stepIndex < steps.length - 1 ? (
                  <button
                    key={`continue-${stepIndex}`}
                    type="button"
                    onClick={handleNextStep}
                    className="lp-pill-dark group inline-flex h-12 items-center gap-2 rounded-full pl-6 pr-5 text-[15px] font-medium"
                  >
                    Continue
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                ) : (
                  <button
                    key="submit-intake"
                    type="button"
                    onClick={() => {
                      void submitIntake();
                    }}
                    disabled={loading}
                    className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: accentColor }}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        Submitting...
                      </>
                    ) : (
                      template.submitLabel || "Submit form"
                    )}
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
