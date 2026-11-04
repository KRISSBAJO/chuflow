"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, CardHeader, EmptyState, Field, formatStatus, statusTone } from "@/components/ui/ui";
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

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId, templates],
  );

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
    <div>
      <CardHeader label="Communications" title={title} />

      <form action={handleSubmit} className="mt-5 rounded-2xl bg-[#f6f5f1] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Template">
            <select
              name="templateName"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="ui-input"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select name="channel" defaultValue="email" className="ui-input">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone_call">Phone call</option>
            </select>
          </Field>
          <Field label="Subject" className="md:col-span-2">
            <input name="subject" defaultValue={activeTemplate.subject} key={`${templateId}-subject`} className="ui-input" />
          </Field>
          <Field label="Recipient" className="md:col-span-2">
            <input name="recipient" defaultValue={recipient} className="ui-input" />
          </Field>
          <Field label="Message" className="md:col-span-2">
            <textarea
              name="message"
              defaultValue={activeTemplate.message}
              key={`${templateId}-message`}
              className="ui-input min-h-28"
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {status ? <p className="text-[13px] text-[#55534e] sm:mr-auto">{status}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send communication"}
          </Button>
        </div>
      </form>

      <div className="mt-5">
        <p className="mb-3 text-[13px] font-medium text-[#6b6b6b]">History</p>
        {communications.length === 0 ? (
          <EmptyState icon="message" title="No messages yet">
            No communication history yet.
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {communications.map((item) => (
              <li key={item._id} className="rounded-2xl border border-black/[0.06] px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#111111]">{item.subject || item.templateName}</p>
                    <p className="mt-0.5 text-[12px] text-[#8a8780]">{formatStatus(item.templateName)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{formatStatus(item.channel)}</Badge>
                    <Badge tone={communicationTone(item.status)} dot>
                      {formatStatus(item.status)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#55534e]">{item.message}</p>
                <p className="mt-2 text-[12px] text-[#8a8780]">
                  {item.deliveredAt
                    ? `Delivered ${new Date(item.deliveredAt).toLocaleString()}`
                    : item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "No timestamp"}
                  {item.deliveryMode ? ` · ${item.deliveryMode.replace(/_/g, " ")}` : ""}
                  {item.previewUrl ? " · SMTP preview mode" : ""}
                  {item.errorMessage ? ` · ${item.errorMessage}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function communicationTone(status: string) {
  return /(sent|delivered)/i.test(status) ? "success" : statusTone(status);
}
