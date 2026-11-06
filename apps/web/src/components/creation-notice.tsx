"use client";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ActionNotice } from "./action-notice";
import { savedToastId } from "@/lib/action-feedback";
export function CreationNotice() {
  const params = useSearchParams();
  const id = params.get("created");
  const t = useTranslations("common");
  if (!id) return null;
  return (
    <ActionNotice
      param="created"
      id={savedToastId({ _id: id })}
      cleanup={["createdName"]}
      message={t("savedSuccessfully", {
        name: params.get("createdName") || t("record"),
      })}
      description={t("reviewUpdatedRecord")}
    />
  );
}
