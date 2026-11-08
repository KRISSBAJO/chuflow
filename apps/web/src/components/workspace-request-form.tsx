"use client";
import { toast } from "sonner";
import { useActionToast } from "@/lib/action-feedback";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  AuthHeading,
  Field,
  SubmitButton,
} from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { PRIMARY_API_URL } from "@/lib/workspace-routing";
import { useGeo } from "@/hooks/use-geo";

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <p className="mb-5 flex items-center gap-3 text-[15px] font-medium text-[var(--lp-ink)]">
      <span className="lp-flame-bg flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold text-white">
        {step}
      </span>
      {title}
    </p>
  );
}

export function WorkspaceRequestForm() {
  const actionToast = useActionToast();

  const t = useTranslations("auth.request");
  const tc = useTranslations("common");
  const { country, states } = useGeo();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [availability, setAvailability] = useState<{ handle: string; status: "available" | "taken" | "invalid" }>();
  const validHandle = /^(?=.{3,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle);
  const status = availability?.handle === handle ? availability.status : undefined;

  useEffect(() => {
    if (!validHandle) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${PRIMARY_API_URL}/workspace-requests/public/handle?handle=${encodeURIComponent(handle)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) {
          const result = await response.json();
          if (!controller.signal.aborted) setAvailability(result);
        }
      } catch {
        // The server still validates the handle on submission.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle, validHandle]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/workspace-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          workspaceHandle: handle,
          contactName: formData.get("contactName"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          country: formData.get("country"),
          state: formData.get("state"),
          city: formData.get("city"),
          branchCount: Number(formData.get("branchCount")) || undefined,
          notes: formData.get("notes"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const reason = result.code === "workspace_handle_taken" ? t("handleTaken")
          : result.code === "workspace_handle_invalid" ? t("handleInvalid")
          : Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message;
        throw new Error(reason || t("failed"));
      }

      setIsSuccess(true);
      setMessage(t("received"));

      actionToast.success(t("received"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failed"));
      setMessage(error instanceof Error ? error.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="lp-rise text-center">
        <div className="lp-flame-bg mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_20px_40px_-15px_rgba(234,88,12,0.6)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="h-7 w-7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h1 className="lp-heading mt-8 text-[2.25rem] leading-[1.05]">
          {t("receivedTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-[380px] text-[16px] leading-[1.6] text-[var(--lp-muted)]">
          {message}
        </p>
        <Link
          href="/login"
          className="lp-pill-dark mt-9 inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-medium"
        >
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title={t("title")} body={t("body")} />

      <form onSubmit={handleSubmit}>
        <SectionTitle step={1} title={t("yourChurch")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("organizationName")}>
              <input
                name="organizationName"
                placeholder={t("organizationPlaceholder")}
                className="lp-input"
                onChange={(event) => {
                  if (!handleEdited) {
                    setHandle(event.target.value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 64).replace(/-+$/, ""));
                  }
                }}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t("workspaceHandle")}>
              <input
                name="workspaceHandle"
                value={handle}
                onChange={(event) => {
                  setHandleEdited(true);
                  setHandle(event.target.value.toLowerCase());
                }}
                className="lp-input"
                placeholder="grace-church-atlanta"
                required
                maxLength={64}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                minLength={3}
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="workspace-handle-feedback"
                aria-invalid={status === "taken" || (!!handle && !validHandle)}
              />
            </Field>
            <p id="workspace-handle-feedback" role="status" className="mt-2 text-sm text-[var(--lp-muted)]">
              {status === "taken" ? t("handleTaken")
                : handle && !validHandle ? t("handleInvalid")
                : status === "available" ? t("handleAvailable")
                : t("handleHint")}
            </p>
          </div>
          <Field label={t("city")}>
            <input
              name="city"
              placeholder={t("cityPlaceholder")}
              className="lp-input"
            />
          </Field>
          <Field label={t("state")}>
            <select name="state" defaultValue="" className="lp-input">
              <option value="">{t("selectState")}</option>
              {states.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
            <input type="hidden" name="country" value={country.name} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("branchCount")} hint={t("branchCountHint")}>
              <input
                name="branchCount"
                type="number"
                min="1"
                placeholder={t("branchCountPlaceholder")}
                className="lp-input"
              />
            </Field>
          </div>
        </div>

        <div className="my-9 h-px bg-black/[0.06]" />

        <SectionTitle step={2} title={t("mainContact")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t("fullName")}>
              <input
                name="contactName"
                placeholder={t("fullNamePlaceholder")}
                autoComplete="name"
                className="lp-input"
                required
              />
            </Field>
          </div>
          <Field label={tc("email")}>
            <input
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              className="lp-input"
              required
            />
          </Field>
          <Field label={t("phone")}>
            <input
              name="phone"
              type="tel"
              placeholder="+234 800 000 0000"
              autoComplete="tel"
              className="lp-input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("notes")}>
              <textarea
                name="notes"
                placeholder={t("notesPlaceholder")}
                className="lp-input"
              />
            </Field>
          </div>
        </div>

        {message ? (
          <div className="mt-6">
            <Alert tone="error">{message}</Alert>
          </div>
        ) : null}

        <div className="mt-8">
          <SubmitButton loading={loading} loadingLabel={t("sending")}>
            {t("submit")}
          </SubmitButton>
          <p className="mt-4 text-center text-[13px] text-[var(--lp-muted)]">
            {t("reviewNote")}
          </p>
        </div>
      </form>
    </div>
  );
}
