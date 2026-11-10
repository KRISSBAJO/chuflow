"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { useYouthAction } from "./use-youth-action";

export function MentoringEmail({ path, activityId, personId, guardian, optedIn, date, attempted }: {
  path: string; activityId: string; personId: string; guardian: boolean; optedIn: boolean; date?: string; attempted: boolean;
}) {
  const t = useTranslations("youth.mentoringEmail");
  const { run, busy } = useYouthAction();
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="space-y-2 border-t border-black/10 pt-3">
    <p className="text-sm">{t(optedIn ? "optedIn" : guardian ? "guardianHint" : "participantHint")}</p>
    {!optedIn ? <>
      <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={async () => {
        setFailed(false);
        setLoading(true);
        try {
          const response = await fetch(API_URL + path + "/mentoring-consent/" + personId, {
            method: "POST", credentials: "include", cache: "no-store",
          });
          if (!response.ok) throw new Error();
          setLink((await response.json()).link);
        } catch { setFailed(true); }
        finally { setLoading(false); }
      }}>{t("createLink")}</Button>
      {link ? <Field label={t("link")}><input className="ui-input" readOnly value={link} onFocus={event => event.currentTarget.select()} /></Field> : null}
      {failed ? <p role="alert" className="text-sm">{t("linkFailed")}</p> : null}
    </> : attempted ? <p role="status" className="text-sm">{t("attempted")}</p> :
      date && date >= new Date().toISOString().slice(0, 10) ? <Button type="button" size="sm" variant="secondary" disabled={busy}
        onClick={() => { if (window.confirm(t("confirm"))) void run(path + "/" + activityId + "/mentoring-email", "POST"); }}>{t("send")}</Button> : null}
  </div>;
}

export function MentoringConsentForm({ token, apiBase, enabled }: { token: string; apiBase: string; enabled: boolean }) {
  const t = useTranslations("youth.mentoringEmail");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return <section className="app-card space-y-4 p-6">
    <h1 className="text-xl font-semibold">{t("preferences")}</h1>
    {state === "done" ? <p role="status">{t(enabled ? "enabled" : "disabled")}</p> : <>
      <p>{t(enabled ? "enableHint" : "disableHint")}</p>
      <Button type="button" disabled={state === "busy"} onClick={async () => {
        setState("busy");
        try {
          const response = await fetch(apiBase + "/youth-registration/mentoring-consent", {
            method: "POST", cache: "no-store", headers: { "x-youth-registration": token, "Content-Type": "application/json" },
            body: JSON.stringify({ enabled, locale }),
          });
          setState(response.ok ? "done" : "error");
        } catch { setState("error"); }
      }}>{t(enabled ? "enable" : "disable")}</Button>
      {state === "error" ? <p role="alert">{t("invalid")}</p> : null}
    </>}
  </section>;
}
