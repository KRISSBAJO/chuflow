"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, Card, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

const statuses = ["new", "praying", "follow_up", "answered", "closed"] as const;
type Status = (typeof statuses)[number];
type Assignee = { _id: string; firstName: string; lastName: string; branchId: string };
type Item = {
  id: string;
  name: string;
  branch?: { _id: string; name: string };
  request: string;
  status: Status;
  revision: number;
  assigneeId: string | null;
  contactAllowed: boolean;
  phone?: string;
  createdAt?: string;
};
export type PrayerCareQueue = { page: number; totalPages: number; canAssign: boolean; items: Item[]; assignees: Assignee[] };

export function PrayerCareCard({ item, assignees }: { item: Item; assignees?: Assignee[] }) {
  const t = useTranslations("people.prayerCare");
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(item.revision);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const assignee = form.get("assigneeId");
    setSaving(true);
    try {
      const response = await fetch(API_URL + "/guests/prayer-care/" + encodeURIComponent(item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          revision, status: form.get("status"),
          ...(typeof assignee === "string" && assignee !== (item.assigneeId ?? "") ? { assigneeId: assignee || null } : {}),
        }),
      });
      if (!response.ok) {
        toast.error(t(response.status === 409 ? "conflict" : "failed"));
        if (response.status === 409) router.refresh();
        return;
      }
      const result = await response.json() as { revision: number };
      setRevision(result.revision);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <header>
        <h2 className="lp-heading text-xl">{item.name}</h2>
        <p className="text-sm text-neutral-600">{[item.branch?.name, item.createdAt ? new Date(item.createdAt).toLocaleDateString(locale) : ""].filter(Boolean).join(" · ")}</p>
      </header>
      <p className="whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-sm leading-relaxed">{item.request}</p>
      <p className="text-sm text-neutral-700">
        {t(item.contactAllowed ? "contactAllowed" : "privateOnly")}
        {item.phone ? <a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`} className="ml-2 underline">{item.phone}</a> : null}
      </p>
      <form onSubmit={save} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label={t("statusLabel")}>
          <select name="status" defaultValue={item.status} className="ui-input">
            {statuses.filter((status) => status !== "follow_up" || item.contactAllowed || item.status === status).map((status) => (
              <option key={status} value={status} disabled={status === "follow_up" && !item.contactAllowed}>{t(`status.${status}`)}</option>
            ))}
          </select>
        </Field>
        {assignees ? (
          <Field label={t("assigned")}>
            <select name="assigneeId" defaultValue={item.assigneeId ?? ""} className="ui-input">
              <option value="">{t("unassigned")}</option>
              {item.assigneeId && !assignees.some(({ _id }) => _id === item.assigneeId) ? <option value={item.assigneeId} disabled>{t("inactive")}</option> : null}
              {assignees.map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}
            </select>
          </Field>
        ) : null}
        <Button type="submit" disabled={saving}>{t("save")}</Button>
      </form>
    </Card>
  );
}
