"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary } from "@/lib/types";
import { Button, Field } from "@/components/ui/ui";

export function ServiceTypeCreateForm({
  branches,
  defaultBranchId,
  currentUserRole,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const t = useTranslations("org.serviceTypes");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/service-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: (formData.get("branchId") as string) || defaultBranchId,
          name: formData.get("name"),
          key: formData.get("key") || undefined,
          isActive: formData.get("isActive") === "on",
          notes: formData.get("notes") || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("createError"));
      }

      toast.success(t("createdTitle"), {
        description: t("createdBody"),
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("createError");
      toast.error(t("createFailed"), {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div>
        <h3 className="lp-heading text-[18px]">{t("heading")}</h3>
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          {t("intro")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {!isBranchScopedRole(currentUserRole) ? (
          <Field label={tCommon("branch")} required>
            <select name="branchId" defaultValue={defaultBranchId || ""} className="ui-input" required>
              <option value="">{tCommon("selectBranch")}</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="branchId" value={defaultBranchId ?? ""} />
        )}

        <Field label={t("displayName")} required>
          <input name="name" placeholder={t("displayNamePlaceholder")} className="ui-input" required />
        </Field>

        <Field label={t("key")} hint={t("keyHint")}>
          <input name="key" placeholder={t("keyPlaceholder")} className="ui-input" />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[14px] text-[#55534e]">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-[#111111]" />
        {t("activeType")}
      </label>

      <Field label={tCommon("notes")} className="mt-4">
        <textarea name="notes" placeholder={t("notesPlaceholder")} className="ui-input" />
      </Field>

      <Button type="submit" disabled={loading} className="mt-5">
        {loading ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
