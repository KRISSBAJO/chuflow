"use client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
/** For actions without a more specific translated completion message. */
export function useActionToast() {
  const t = useTranslations("common");
  return {
    download: () => toast.success(t("downloadReady")),
    copyFailed: () => toast.error(t("copyFailed")),
    success: (message?: string) =>
      toast.success(message || t("savedSuccessfully", { name: t("record") })),
  };
}
export function savedToastId(result: unknown) {
  const value = result as { _id?: string; id?: string } | null;
  return `record-saved:${value?._id || value?.id || "saved"}`;
}
