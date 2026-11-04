"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { OUTREACH_INTERESTS, OUTREACH_METHODS } from "@/lib/evangelism";
import type { BranchSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";

export function OutreachContactForm({
  token,
  branchName,
  branches = [],
  defaultBranchId,
}: {
  token?: string;
  branchName?: string;
  branches?: BranchSummary[];
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("phone_call");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const optional = (key: string) =>
      String(data.get(key) || "").trim() || undefined;
    try {
      const body = {
        firstName: data.get("firstName"),
        lastName: data.get("lastName"),
        phone: data.get("phone"),
        email: optional("email"),
        city: optional("city"),
        prayerRequest: optional("prayerRequest"),
        interest: optional("interest"),
        preferredContactTime: optional("preferredContactTime"),
        preferredContactMethod: method,
        consentToContact: data.get("consent") === "on",
        website: optional("website"),
        ...(!token ? { branchId: data.get("branchId") } : {}),
      };
      const result = await apiPost<{ id?: string }>(
        token ? `/evangelism/public/${token}` : "/evangelism/contacts",
        body,
      );
      if (token) setDone(true);
      else {
        router.push(`/evangelism/${result.id}`);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <Card className="p-8" role="status">
        <h2 className="text-2xl font-semibold">Thank you for connecting.</h2>
        <p className="mt-3 text-[#6b6b6b]">
          Your details have been received by {branchName || "the church team"}.
          We look forward to connecting with you.
        </p>
      </Card>
    );
  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-5">
        {!token && (
          <Field label="Branch" required>
            <select
              name="branchId"
              defaultValue={defaultBranchId || branches[0]?._id}
              className="ui-input"
              required
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" required>
            <input
              name="firstName"
              autoComplete="given-name"
              className="ui-input"
              required
              maxLength={80}
            />
          </Field>
          <Field label="Last name" required>
            <input
              name="lastName"
              autoComplete="family-name"
              className="ui-input"
              required
              maxLength={80}
            />
          </Field>
          <Field
            label="Phone, including country code"
            required
            hint="For example, +1 615 555 0123"
          >
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className="ui-input"
              required
              minLength={7}
              maxLength={30}
            />
          </Field>
          <Field label="Email" required={method === "email"}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="ui-input"
              required={method === "email"}
              maxLength={150}
            />
          </Field>
          <Field label="City or area">
            <input
              name="city"
              autoComplete="address-level2"
              className="ui-input"
              maxLength={150}
            />
          </Field>
          <Field label="Preferred way to connect" required>
            <select
              className="ui-input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {OUTREACH_METHODS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What would you like help with?">
            <select name="interest" className="ui-input" defaultValue="">
              <option value="">Choose if you wish</option>
              {OUTREACH_INTERESTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Best time to contact you"
            hint="Include your time zone if helpful."
          >
            <input
              name="preferredContactTime"
              className="ui-input"
              maxLength={150}
              placeholder="For example, weekday evenings"
            />
          </Field>
        </div>
        <Field
          label="How can we pray for you?"
          hint="Optional. Only share what you’re comfortable sharing with the church care team."
        >
          <textarea
            name="prayerRequest"
            rows={3}
            className="ui-input"
            maxLength={1000}
          />
        </Field>
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>
            {token
              ? `I agree that ${branchName || "this church"} may use these details to contact me about my request and church activities. I can ask the team to stop contacting me at any time.`
              : "The person has given permission for this church to record these details and contact them. They understand they can ask us to stop."}
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || (!token && !branches.length)}>
          {busy
            ? "Submitting…"
            : token
              ? "Connect with us"
              : "Add outreach contact"}
        </Button>
      </form>
    </Card>
  );
}
