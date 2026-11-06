"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CreationNotice() {
  const params = useSearchParams();
  const id = params.get("created");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const t = useTranslations("common");
  if (!id || dismissed === id) return null;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
    >
      <p>
        <strong>{t("savedSuccessfully", { name: params.get("createdName") || t("record") })}</strong> {t("reviewUpdatedRecord")}
      </p>
      <button
        type="button"
        aria-label={t("dismissConfirmation")}
        onClick={() => setDismissed(id)}
        className="px-2 text-lg"
      >
        ×
      </button>
    </div>
  );
}
