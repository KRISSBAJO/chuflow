"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

export function GuestProfileForm({
  guest,
  defaultBranchId,
}: {
  guest: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    title?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    maritalStatus?: string;
    invitedBy?: string;
    heardAboutChurch?: string;
    prayerRequest?: string;
    salvationResponse?: string;
    visitStatus: string;
    branchId?: { _id?: string; name?: string };
  };
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/guests/${guest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: guest.branchId?._id || defaultBranchId,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email") || undefined,
          title: formData.get("title") || undefined,
          gender: formData.get("gender") || undefined,
          address: formData.get("address") || undefined,
          city: formData.get("city") || undefined,
          state: formData.get("state") || undefined,
          zipCode: formData.get("zipCode") || undefined,
          maritalStatus: formData.get("maritalStatus") || undefined,
          invitedBy: formData.get("invitedBy") || undefined,
          heardAboutChurch: formData.get("heardAboutChurch") || undefined,
          prayerRequest: formData.get("prayerRequest") || undefined,
          salvationResponse: formData.get("salvationResponse") || undefined,
          visitStatus: formData.get("visitStatus") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update guest");
      }

      setStatus("Guest profile successfully updated ✓");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update guest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <FormGroup title="Basic information">
        <Field label="Title">
          <input name="title" defaultValue={guest.title || ""} placeholder="Mr, Mrs, Pastor…" className="ui-input" />
        </Field>
        <Field label="Gender">
          <input name="gender" defaultValue={guest.gender || ""} placeholder="Gender" className="ui-input" />
        </Field>
        <Field label="First name" required>
          <input name="firstName" defaultValue={guest.firstName} required placeholder="First name" className="ui-input" />
        </Field>
        <Field label="Last name" required>
          <input name="lastName" defaultValue={guest.lastName} required placeholder="Last name" className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title="Contact information">
        <Field label="Phone number" required>
          <input name="phone" defaultValue={guest.phone} required placeholder="Phone number" className="ui-input" />
        </Field>
        <Field label="Email">
          <input name="email" defaultValue={guest.email || ""} placeholder="name@example.com" type="email" className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title="Additional details">
        <Field label="Marital status">
          <input name="maritalStatus" defaultValue={guest.maritalStatus || ""} placeholder="Marital status" className="ui-input" />
        </Field>
        <Field label="Visit status">
          <input name="visitStatus" defaultValue={guest.visitStatus} placeholder="Visit status" className="ui-input" />
        </Field>
        <Field label="Invited by">
          <input name="invitedBy" defaultValue={guest.invitedBy || ""} placeholder="Who invited them?" className="ui-input" />
        </Field>
        <Field label="How they heard about us">
          <input
            name="heardAboutChurch"
            defaultValue={guest.heardAboutChurch || ""}
            placeholder="Friend, social media, walk-in…"
            className="ui-input"
          />
        </Field>
        <Field label="Street address" className="md:col-span-2">
          <input name="address" defaultValue={guest.address || ""} placeholder="Street address" className="ui-input" />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={guest.city || ""} placeholder="City" className="ui-input" />
        </Field>
        <Field label="State">
          <input name="state" defaultValue={guest.state || ""} placeholder="State" className="ui-input" />
        </Field>
        <Field label="Zip code">
          <input name="zipCode" defaultValue={guest.zipCode || ""} placeholder="Zip code" className="ui-input" />
        </Field>
      </FormGroup>

      <FormGroup title="Spiritual information">
        <Field label="Salvation response" className="md:col-span-2">
          <input
            name="salvationResponse"
            defaultValue={guest.salvationResponse || ""}
            placeholder="Salvation response"
            className="ui-input"
          />
        </Field>
        <Field label="Prayer request" className="md:col-span-2">
          <textarea name="prayerRequest" defaultValue={guest.prayerRequest || ""} placeholder="Prayer request" className="ui-input" />
        </Field>
      </FormGroup>

      <div className="flex flex-col-reverse gap-3 border-t border-black/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-end">
        {status ? (
          <p
            className={`text-[13px] sm:mr-auto ${
              status.includes("success") || status.includes("✓") ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {status}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving changes..." : "Save guest profile"}
        </Button>
      </div>
    </form>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-[13px] font-medium text-[#6b6b6b]">{title}</legend>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}
