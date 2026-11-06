"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Badge, Button, CardHeader, EmptyState, Field } from "@/components/ui/ui";
import { useStatusLabel } from "@/i18n/labels";
import type { CommunicationTemplateItem } from "@/lib/types";

export function CommunicationTemplateManagementCard({
  templates,
  canManage,
}: {
  templates: CommunicationTemplateItem[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.communicationTemplates");
  const tcm = useTranslations("admin.communications");
  const tc = useTranslations("common");
  const ts = useTranslations("statuses");
  const statusLabel = useStatusLabel();
  const formatChannel = (channel?: string) => {
    switch (channel) {
      case "email":
      case "sms":
      case "phone_call":
        return tcm(`channels.${channel}`);
      default:
        return statusLabel(channel);
    }
  };
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?._id ?? "new");
  const [loading, setLoading] = useState(false);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template._id === selectedId) || null,
    [selectedId, templates],
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    const isNew = selectedId === "new";
    const payload = {
      key: formData.get("key"),
      name: formData.get("name"),
      channel: formData.get("channel"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      isActive: formData.get("isActive") === "on",
      sortOrder: Number(formData.get("sortOrder") || 100),
    };

    try {
      const response = await fetch(
        `${API_URL}/communications/templates${isNew ? "" : `/${selectedId}`}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("saveError"));
      }

      toast.success(isNew ? t("createdTitle") : t("updatedTitle"));
      router.refresh();
    } catch (error) {
      toast.error(t("saveFailedTitle"), {
        description:
          error instanceof Error ? error.message : t("saveError"),
      });
    } finally {
      setLoading(false);
    }
  }


  return (
    <div>
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
        action={
          canManage ? (
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setSelectedId("new")}>
              {t("newTemplate")}
            </Button>
          ) : null
        }
      />

      <div className="mt-6 space-y-2">
        {templates.length === 0 ? (
          <EmptyState icon="message" title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        ) : null}
        {templates.map((template) => {
          const active = selectedId === template._id;
          return (
            <button
              key={template._id}
              type="button"
              onClick={() => setSelectedId(template._id)}
              aria-pressed={active}
              className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                active
                  ? "border-[#111111] bg-white shadow-[0_0_0_3px_rgba(17,17,17,0.06)]"
                  : "border-black/[0.06] bg-white hover:border-black/[0.12] hover:bg-[#faf9f6]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-[#111111]">{template.name}</span>
                <Badge>{formatChannel(template.channel)}</Badge>
                <Badge tone={template.isActive ? "success" : "danger"} dot>
                  {template.isActive ? ts("active") : t("paused")}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-[#6b6b6b]">
                {template.subject || template.message.slice(0, 110)}
              </p>
            </button>
          );
        })}
      </div>

      {canManage ? (
        <form action={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-[#f6f5f1] p-4 sm:p-5">
          <p className="text-[13px] font-medium text-[#6b6b6b]">
            {selectedTemplate ? t("editing", { name: selectedTemplate.name }) : t("newTemplate")}
          </p>
          <Field label={t("key")} hint={selectedTemplate ? t("keyHint") : undefined}>
            <input
              name="key"
              defaultValue={selectedTemplate?.key || ""}
              disabled={!!selectedTemplate}
              className="ui-input"
            />
          </Field>
          <Field label={t("name")}>
            <input
              name="name"
              defaultValue={selectedTemplate?.name || ""}
              key={`${selectedId}-name`}
              className="ui-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("channel")}>
              <select
                name="channel"
                defaultValue={selectedTemplate?.channel || "email"}
                key={`${selectedId}-channel`}
                className="ui-input"
              >
                <option value="email">{tcm("channels.email")}</option>
                <option value="sms">{tcm("channels.sms")}</option>
                <option value="phone_call">{tcm("channels.phone_call")}</option>
              </select>
            </Field>
            <Field label={t("sortOrder")}>
              <input
                type="number"
                min={0}
                max={999}
                name="sortOrder"
                defaultValue={selectedTemplate?.sortOrder || 100}
                key={`${selectedId}-sort`}
                className="ui-input tabular-nums"
              />
            </Field>
          </div>
          <Field label={t("subject")}>
            <input
              name="subject"
              defaultValue={selectedTemplate?.subject || ""}
              key={`${selectedId}-subject`}
              className="ui-input"
            />
          </Field>
          <Field label={t("message")}>
            <textarea
              name="message"
              defaultValue={selectedTemplate?.message || ""}
              key={`${selectedId}-message`}
              className="ui-input !min-h-36"
            />
          </Field>

          <label className="flex items-start gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-[14px] text-[#55534e]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={selectedTemplate?.isActive ?? true}
              key={`${selectedId}-active`}
              className="mt-0.5 h-4 w-4 accent-[#111111]"
            />
            {t("activeHelp")}
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading
                ? tc("saving")
                : selectedTemplate
                  ? t("saveTemplate")
                  : t("createTemplate")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-2xl bg-[#f6f5f1] px-4 py-3.5 text-[13px] leading-[1.6] text-[#6b6b6b]">
          {t("readOnly")}
        </p>
      )}
    </div>
  );
}
