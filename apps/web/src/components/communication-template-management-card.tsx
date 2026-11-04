"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { Badge, Button, CardHeader, EmptyState, Field, formatStatus } from "@/components/ui/ui";
import type { CommunicationTemplateItem } from "@/lib/types";

export function CommunicationTemplateManagementCard({
  templates,
  canManage,
}: {
  templates: CommunicationTemplateItem[];
  canManage: boolean;
}) {
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
        throw new Error(result.message || "Unable to save template");
      }

      toast.success(isNew ? "Template created" : "Template updated");
      router.refresh();
    } catch (error) {
      toast.error("Template save failed", {
        description:
          error instanceof Error ? error.message : "Unable to save template",
      });
    } finally {
      setLoading(false);
    }
  }


  return (
    <div>
      <CardHeader
        label="Templates"
        title="Shared message templates"
        description="Keep welcome, reminder and care messages consistent across the ministry."
        action={
          canManage ? (
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setSelectedId("new")}>
              New template
            </Button>
          ) : null
        }
      />

      <div className="mt-6 space-y-2">
        {templates.length === 0 ? (
          <EmptyState icon="message" title="No templates yet">
            Shared templates will appear here once they are created.
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
                  {template.isActive ? "Active" : "Paused"}
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
            {selectedTemplate ? `Editing ${selectedTemplate.name}` : "New template"}
          </p>
          <Field label="Key" hint={selectedTemplate ? "Keys cannot be changed after creation." : undefined}>
            <input
              name="key"
              defaultValue={selectedTemplate?.key || ""}
              disabled={!!selectedTemplate}
              className="ui-input"
            />
          </Field>
          <Field label="Name">
            <input
              name="name"
              defaultValue={selectedTemplate?.name || ""}
              key={`${selectedId}-name`}
              className="ui-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <select
                name="channel"
                defaultValue={selectedTemplate?.channel || "email"}
                key={`${selectedId}-channel`}
                className="ui-input"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="phone_call">Phone call</option>
              </select>
            </Field>
            <Field label="Sort order">
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
          <Field label="Subject">
            <input
              name="subject"
              defaultValue={selectedTemplate?.subject || ""}
              key={`${selectedId}-subject`}
              className="ui-input"
            />
          </Field>
          <Field label="Message">
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
            Template is active and available in outreach flows.
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading
                ? "Saving..."
                : selectedTemplate
                  ? "Save template"
                  : "Create template"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-2xl bg-[#f6f5f1] px-4 py-3.5 text-[13px] leading-[1.6] text-[#6b6b6b]">
          Templates are shared across the workspace. Only the overall oversight admin can edit them.
        </p>
      )}
    </div>
  );
}

function formatChannel(channel?: string) {
  switch (channel) {
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "phone_call":
      return "Phone call";
    default:
      return formatStatus(channel);
  }
}
