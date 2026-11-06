"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";

export function ChangePasswordForm() {
  const t = useTranslations("admin.settings.password");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setStatus(t("mismatch"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus(t("changed"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form action={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("current")} required className="md:col-span-2">
            <input
              name="currentPassword"
              type="password"
              placeholder={t("current")}
              autoComplete="current-password"
              className="ui-input"
              required
            />
          </Field>
          <Field label={t("new")} required>
            <input
              name="newPassword"
              type="password"
              placeholder={t("new")}
              autoComplete="new-password"
              className="ui-input"
              required
            />
          </Field>
          <Field label={t("confirm")} required>
            <input
              name="confirmPassword"
              type="password"
              placeholder={t("confirm")}
              autoComplete="new-password"
              className="ui-input"
              required
            />
          </Field>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-black/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-end">
          {status ? (
            <p role="status" className="text-[13px] text-[#6b6b6b] sm:mr-auto">
              {status}
            </p>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? t("updating") : t("update")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
