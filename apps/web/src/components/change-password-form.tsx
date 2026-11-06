"use client";
import { toast } from "sonner";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";

export function ChangePasswordForm() {
  const t = useTranslations("admin.settings.password");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      toast.error(t("mismatch"));
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

      toast.success(t("changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failed"));
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
          <Button type="submit" disabled={loading}>
            {loading ? t("updating") : t("update")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
