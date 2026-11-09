"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/ui";
import type { GuardianReminderFields } from "@/lib/youth";
import { useYouthAction } from "./use-youth-action";

export function GuardianReminder({ person, path }: { person: GuardianReminderFields; path: string }) {
  const t = useTranslations("youth.guardianMessaging");
  const { run, busy } = useYouthAction();
  if (!person.guardianEmailOptIn) return null;
  if (person.guardianReminderStatus) return <p className="text-sm" role="status">{t(person.guardianReminderStatus)}</p>;
  return <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => {
    if (window.confirm(t("confirm"))) void run(path + "/guardian-reminder", "POST");
  }}>{t("send")}</Button>;
}

export function GuardianUnsubscribe({ token, apiBase }: { token: string; apiBase: string }) {
  const t = useTranslations("youth.guardianMessaging");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  return <section className="app-card space-y-4 p-6">
    <h1 className="text-xl font-semibold">{t("unsubscribe")}</h1>
    {status === "done" ? <p role="status">{t("unsubscribed")}</p> : <>
      <p>{t("unsubscribeHint")}</p>
      <Button type="button" disabled={status === "busy"} onClick={async () => {
        setStatus("busy");
        try {
          const response = await fetch(apiBase + "/youth-registration/unsubscribe", {
            method: "POST", headers: { "x-youth-registration": token }, cache: "no-store",
          });
          setStatus(response.ok ? "done" : "error");
        } catch { setStatus("error"); }
      }}>{t("unsubscribe")}</Button>
      {status === "error" ? <p role="alert">{t("unsubscribeError")}</p> : null}
    </>}
  </section>;
}
