"use client";
import { toast } from "sonner";

import { useSession } from "./session-context";
import { hasPermission } from "@/lib/capabilities";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  CardHeader,
  EmptyState,
  Field,
  statusTone,
} from "@/components/ui/ui";
import { useAppFormat, useStatusLabel } from "@/i18n/labels";
import { API_URL } from "@/lib/api";
import { communicationTemplates } from "@/lib/communication-templates";
import type { CommunicationItem, CommunicationTemplateItem } from "@/lib/types";

export function CommunicationPanel({
  recipientType,
  recipientId,
  recipient,
  communications,
  title,
}: {
  recipientType: "guest" | "member";
  recipientId: string;
  recipient: string;
  communications: CommunicationItem[];
  title?: string;
}) {
  const t = useTranslations("admin.communicationPanel");
  const tcm = useTranslations("admin.communications");
  const { dateTime } = useAppFormat();
  const statusLabel = useStatusLabel();
  const router = useRouter();
  const { user } = useSession();
  const canSend = !!user && hasPermission(user, "communications.send");

  const [loading, startTransition] = useTransition();
  const [templates, setTemplates] = useState<
    Array<{ id: string; label: string; subject: string; message: string }>
  >(() =>
    communicationTemplates.map((template) => {
      type Key = Parameters<typeof t>[0];
      const key = (field: "label" | "subject" | "message") =>
        `defaults.${template.id}.${field}` as Key;
      return {
        id: template.id,
        label: t.has(key("label")) ? t(key("label")) : template.label,
        subject: t.has(key("subject")) ? t(key("subject")) : template.subject,
        message: t.has(key("message")) ? t(key("message")) : template.message,
      };
    }),
  );
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
    () =>
      templates.find((template) => template.id === templateId) ?? templates[0],
    [templateId, templates],
  );

  async function handleSubmit(formData: FormData) {
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
        throw new Error(result.message || t("sendError"));
      }

      toast[
        result.status === "failed"
          ? "error"
          : result.status === "preview"
            ? "info"
            : "success"
      ](
        result.status === "failed"
          ? t("loggedFailed")
          : result.status === "preview"
            ? t("savedPreview")
            : t("sentLogged"),
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sendError"));
    }
  }

  return (
    <div>
      <CardHeader label={t("label")} title={title ?? t("defaultTitle")} />

      {canSend && (
        <form
          action={handleSubmit}
          className="mt-5 rounded-2xl bg-[#f6f5f1] p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("template")}>
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
            <Field label={t("channel")}>
              <select name="channel" defaultValue="email" className="ui-input">
                <option value="email">{tcm("channels.email")}</option>
                <option value="sms">{tcm("channels.sms")}</option>
                <option value="phone_call">{tcm("channels.phone_call")}</option>
              </select>
            </Field>
            <Field label={t("subject")} className="md:col-span-2">
              <input
                name="subject"
                defaultValue={activeTemplate.subject}
                key={`${templateId}-subject`}
                className="ui-input"
              />
            </Field>
            <Field label={t("recipient")} className="md:col-span-2">
              <input
                name="recipient"
                defaultValue={recipient}
                className="ui-input"
              />
            </Field>
            <Field label={t("message")} className="md:col-span-2">
              <textarea
                name="message"
                defaultValue={activeTemplate.message}
                key={`${templateId}-message`}
                className="ui-input min-h-28"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? t("sending") : t("send")}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-5">
        <p className="mb-3 text-[13px] font-medium text-[#6b6b6b]">
          {t("history")}
        </p>
        {communications.length === 0 ? (
          <EmptyState icon="message" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {communications.map((item) => (
              <li
                key={item._id}
                className="rounded-2xl border border-black/[0.06] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#111111]">
                      {item.subject || item.templateName}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8a8780]">
                      {statusLabel(item.templateName)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{statusLabel(item.channel)}</Badge>
                    <Badge tone={communicationTone(item.status)} dot>
                      {statusLabel(item.status)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#55534e]">
                  {item.message}
                </p>
                <p className="mt-2 text-[12px] text-[#8a8780]">
                  {item.deliveredAt
                    ? t("delivered", { date: dateTime(item.deliveredAt) })
                    : item.createdAt
                      ? dateTime(item.createdAt)
                      : t("noTimestamp")}
                  {item.deliveryMode
                    ? ` · ${item.deliveryMode.replace(/_/g, " ")}`
                    : ""}
                  {item.previewUrl ? ` · ${t("smtpPreview")}` : ""}
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
