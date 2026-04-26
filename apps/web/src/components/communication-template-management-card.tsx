"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
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
    <section className="rounded-[28px] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Templates</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Shared message templates
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Keep welcome, reminder, and care messages consistent across the ministry.
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={() => setSelectedId("new")}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            New template
          </button>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {templates.map((template) => (
          <button
            key={template._id}
            type="button"
            onClick={() => setSelectedId(template._id)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
              selectedId === template._id
                ? "border-slate-900 bg-slate-950 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{template.name}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  selectedId === template._id
                    ? "bg-white/15 text-white"
                    : "bg-white text-slate-500"
                }`}
              >
                {template.channel}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                  template.isActive
                    ? selectedId === template._id
                      ? "bg-emerald-400/20 text-emerald-100"
                      : "bg-emerald-50 text-emerald-700"
                    : selectedId === template._id
                      ? "bg-rose-400/20 text-rose-100"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {template.isActive ? "Active" : "Paused"}
              </span>
            </div>
            <p
              className={`mt-2 text-sm ${
                selectedId === template._id ? "text-white/80" : "text-slate-500"
              }`}
            >
              {template.subject || template.message.slice(0, 110)}
            </p>
          </button>
        ))}
      </div>

      {canManage ? (
        <form action={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Key</span>
              <input
                name="key"
                defaultValue={selectedTemplate?.key || ""}
                disabled={!!selectedTemplate}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none disabled:opacity-60"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                name="name"
                defaultValue={selectedTemplate?.name || ""}
                key={`${selectedId}-name`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Channel</span>
              <select
                name="channel"
                defaultValue={selectedTemplate?.channel || "email"}
                key={`${selectedId}-channel`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="phone_call">Phone call</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Sort order</span>
              <input
                type="number"
                min={0}
                max={999}
                name="sortOrder"
                defaultValue={selectedTemplate?.sortOrder || 100}
                key={`${selectedId}-sort`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Subject</span>
              <input
                name="subject"
                defaultValue={selectedTemplate?.subject || ""}
                key={`${selectedId}-subject`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Message</span>
              <textarea
                name="message"
                defaultValue={selectedTemplate?.message || ""}
                key={`${selectedId}-message`}
                className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={selectedTemplate?.isActive ?? true}
              key={`${selectedId}-active`}
              className="h-4 w-4"
            />
            Template is active and available in outreach flows.
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            {loading
              ? "Saving..."
              : selectedTemplate
                ? "Save template"
                : "Create template"}
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
          Templates are shared across the workspace. Only the overall oversight admin can edit them.
        </div>
      )}
    </section>
  );
}
