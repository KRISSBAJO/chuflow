"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { communicationTemplates } from "@/lib/communication-templates";
import type { CommunicationItem, CommunicationTemplateItem } from "@/lib/types";

export function GuestCommunicationPanel({
  guestId,
  recipient,
  communications,
}: {
  guestId: string;
  recipient: string;
  communications: CommunicationItem[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; label: string; subject: string; message: string }>
  >(communicationTemplates);
  const [templateId, setTemplateId] = useState(
    communicationTemplates[0]?.id || "welcome_first_timer",
  );

  useEffect(() => {
    let active = true;

    async function loadTemplates() {
      try {
        const response = await fetch(`${API_URL}/communications/templates`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as CommunicationTemplateItem[];
        if (!active || result.length === 0) {
          return;
        }

        const mapped = result
          .filter((template) => template.isActive)
          .map((template) => ({
            id: template.key,
            label: template.name,
            subject: template.subject || template.name,
            message: template.message,
          }));

        if (mapped.length > 0) {
          setTemplates(mapped);
          setTemplateId((current) =>
            mapped.some((template) => template.id === current)
              ? current
              : mapped[0].id,
          );
        }
      } catch {
        // Keep bundled defaults if the API is unavailable.
      }
    }

    void loadTemplates();

    return () => {
      active = false;
    };
  }, []);

  const activeTemplate =
    useMemo(
      () => templates.find((template) => template.id === templateId) ?? templates[0],
      [templateId, templates],
    ) ?? templates[0];

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/communications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guestId,
          templateName: formData.get("templateName"),
          channel: formData.get("channel"),
          recipient: formData.get("recipient"),
          message: formData.get("message"),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to send communication");
      }

      setStatus(
        result.status === "failed"
          ? "Communication attempt was logged as failed."
          : result.status === "preview"
            ? "Communication saved in preview mode."
            : "Communication logged successfully.",
      );
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send communication");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface rounded-[32px] p-6">
      <p className="eyebrow">Communications</p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">Send and review outreach history</h2>

      <form action={handleSubmit} className="mt-5 rounded-[28px] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            name="templateName"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <select name="channel" defaultValue="email" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="phone_call">Phone call</option>
          </select>
          <input name="recipient" defaultValue={recipient} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2" />
          <textarea
            name="message"
            defaultValue={
              activeTemplate?.message ||
              "Thank you for worshipping with us. We are glad you came and would love to stay connected."
            }
            key={`${templateId}-message`}
            className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
          />
        </div>
        <button type="submit" disabled={loading} className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
          {loading ? "Saving..." : "Log communication"}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {communications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            No communication history yet for this guest.
          </div>
        ) : (
          communications.map((item) => (
            <div key={item._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{item.templateName}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {item.channel}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.message}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : "No timestamp"} · {item.status}
                {item.deliveryMode ? ` · ${item.deliveryMode.replace(/_/g, " ")}` : ""}
              </p>
              {item.errorMessage ? (
                <p className="mt-2 text-xs text-rose-600">{item.errorMessage}</p>
              ) : null}
            </div>
          ))
        )}
      </div>

      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
