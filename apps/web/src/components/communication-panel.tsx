"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { communicationTemplates } from "@/lib/communication-templates";
import type { CommunicationItem, CommunicationTemplateItem } from "@/lib/types";

export function CommunicationPanel({
  recipientType,
  recipientId,
  recipient,
  communications,
  title = "Send and review outreach history",
}: {
  recipientType: "guest" | "member";
  recipientId: string;
  recipient: string;
  communications: CommunicationItem[];
  title?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [templates, setTemplates] = useState<
    Array<{ id: string; label: string; subject: string; message: string }>
  >(communicationTemplates);
  const [templateId, setTemplateId] = useState(
    communicationTemplates[0]?.id ?? "welcome_first_timer",
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

        if (mapped.length === 0) {
          return;
        }

        setTemplates(mapped);
        setTemplateId((current) =>
          mapped.some((template) => template.id === current)
            ? current
            : mapped[0].id,
        );
      } catch {
        // Keep the bundled defaults when templates cannot be loaded.
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
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/communications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          [recipientType === "guest" ? "guestId" : "memberId"]: recipientId,
          templateName: formData.get("templateName"),
          subject: formData.get("subject"),
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
            : "Communication sent and logged.",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send communication");
    }
  }

  return (
    <section className="surface rounded-[24px] p-5">
      <p className="eyebrow">Communications</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>

      <form action={handleSubmit} className="mt-4 rounded-[18px] bg-white p-4">
        <div className="grid gap-2.5 md:grid-cols-2">
          <select
            name="templateName"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <select name="channel" defaultValue="email" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="phone_call">Phone call</option>
          </select>
          <input
            name="subject"
            defaultValue={activeTemplate.subject}
            key={`${templateId}-subject`}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <input
            name="recipient"
            defaultValue={recipient}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
          <textarea
            name="message"
            defaultValue={activeTemplate.message}
            key={`${templateId}-message`}
            className="min-h-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none md:col-span-2"
          />
        </div>
        <button type="submit" disabled={loading} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          {loading ? "Sending..." : "Send communication"}
        </button>
      </form>

      <div className="mt-4 space-y-2.5">
        {communications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
            No communication history yet.
          </div>
        ) : (
          communications.map((item) => (
            <div key={item._id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.subject || item.templateName}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {item.templateName.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{item.channel}</span>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">{item.status}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.message}</p>
              <p className="mt-2 text-xs text-slate-400">
                {item.deliveredAt
                  ? `Delivered ${new Date(item.deliveredAt).toLocaleString()}`
                  : item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "No timestamp"}
                {item.deliveryMode ? ` · ${item.deliveryMode.replace(/_/g, " ")}` : ""}
                {item.previewUrl ? " · SMTP preview mode" : ""}
                {item.errorMessage ? ` · ${item.errorMessage}` : ""}
              </p>
            </div>
          ))
        )}
      </div>

      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
