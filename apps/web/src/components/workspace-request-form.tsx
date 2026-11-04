"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AuthHeading, Field, SubmitButton } from "@/components/auth/auth-ui";
import { API_URL } from "@/lib/api";
import { useGeo } from "@/hooks/use-geo";

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <p className="mb-5 flex items-center gap-3 text-[15px] font-medium text-[var(--lp-ink)]">
      <span className="lp-flame-bg flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold text-white">{step}</span>
      {title}
    </p>
  );
}

export function WorkspaceRequestForm() {
  const { country, states } = useGeo();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(`${API_URL}/workspace-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
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
        const reason = Array.isArray(result.message)
          ? result.message.join(", ")
          : result.message;
        throw new Error(reason || "Unable to send workspace request");
      }

      setIsSuccess(true);
      setMessage("Request received. The admin team will review it and be in touch.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to send workspace request",
      );
    } finally {
      setLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="lp-rise text-center">
        <div className="lp-flame-bg mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_20px_40px_-15px_rgba(234,88,12,0.6)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="lp-heading mt-8 text-[2.25rem] leading-[1.05]">Request received</h1>
        <p className="mx-auto mt-3 max-w-[380px] text-[16px] leading-[1.6] text-[var(--lp-muted)]">{message}</p>
        <Link href="/login" className="lp-pill-dark mt-9 inline-flex h-12 items-center justify-center rounded-full px-7 text-[15px] font-medium">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading
        title="Request a workspace"
        body="Tell us about your church and we'll set up your workspace, structure and first accounts."
      />

      <form action={handleSubmit}>
        <SectionTitle step={1} title="Your church" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Church or organization name">
              <input name="organizationName" placeholder="Grace Community Church" className="lp-input" required />
            </Field>
          </div>
          <Field label="City">
            <input name="city" placeholder="Lagos" className="lp-input" />
          </Field>
          <Field label="State or province">
            <select name="state" defaultValue="" className="lp-input">
              <option value="">Select state</option>
              {states.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>
              ))}
            </select>
            <input type="hidden" name="country" value={country.name} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="How many branches?" hint="An estimate is fine. You can add more later.">
              <input name="branchCount" type="number" min="1" placeholder="e.g. 5" className="lp-input" />
            </Field>
          </div>
        </div>

        <div className="my-9 h-px bg-black/[0.06]" />

        <SectionTitle step={2} title="Main contact" />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Full name">
              <input name="contactName" placeholder="Pastor John Smith" autoComplete="name" className="lp-input" required />
            </Field>
          </div>
          <Field label="Email">
            <input name="email" type="email" placeholder="pastor@church.org" autoComplete="email" className="lp-input" required />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" placeholder="+234 800 000 0000" autoComplete="tel" className="lp-input" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Anything we should know?">
              <textarea name="notes" placeholder="Your church structure, special requirements, timeline..." className="lp-input" />
            </Field>
          </div>
        </div>

        {message ? (
          <div className="mt-6">
            <Alert tone="error">{message}</Alert>
          </div>
        ) : null}

        <div className="mt-8">
          <SubmitButton loading={loading} loadingLabel="Sending request...">
            Send request
          </SubmitButton>
          <p className="mt-4 text-center text-[13px] text-[var(--lp-muted)]">
            We&apos;ll review your request and get back to you by email.
          </p>
        </div>
      </form>
    </div>
  );
}
