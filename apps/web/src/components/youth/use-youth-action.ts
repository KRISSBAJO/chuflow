"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";

export function useYouthAction() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = useTranslations("youth");
  async function run(path: string, method: "POST" | "PATCH" | "DELETE", data?: object) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(API_URL + path, {
        method, credentials: "include",
        ...(data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        if (error?.code === "youth_event_full") {
          toast.error(t("eventFull"));
          router.refresh();
          return;
        }
        throw new Error();
      }
      toast.success(t("saved"));
      router.refresh();
      return true;
    } catch {
      toast.error(t("failed"));
      if (path.endsWith("/guardian-reminder") || path.endsWith("/mentoring-email")) router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
