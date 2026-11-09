"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

export function ParticipantInvite({ path }: { path: string }) {
  const t = useTranslations("youth.participantInvite");
  const [invitation, setInvitation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"conflict" | "failed">();
  return <details className="w-full rounded-lg border border-black/10 p-3" onToggle={event => {
    if (!event.currentTarget.open) setInvitation("");
  }}>
    <summary className="cursor-pointer text-sm font-semibold">{t("title")}</summary>
    {invitation ? <div className="mt-3 space-y-2">
      <p className="text-sm">{t("shareHint")}</p>
      <Field label={t("link")}><input className="ui-input" readOnly value={invitation} onFocus={event => event.currentTarget.select()} /></Field>
    </div> : <form className="mt-3 space-y-3" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setError(undefined);
      try {
        const response = await fetch(API_URL + path + "/invite", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.get("email"), permissionConfirmed: form.has("permission") }),
        });
        if (response.ok) setInvitation((await response.json()).invitation);
        else setError(response.status === 409 ? "conflict" : "failed");
      } catch { setError("failed"); }
      finally { setBusy(false); }
    }}>
      <Field label={t("email")}><input className="ui-input" name="email" type="email" maxLength={254} required /></Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="permission" required />{t("permission")}</label>
      <Button type="submit" size="sm" disabled={busy}>{t("create")}</Button>
      {error ? <p className="text-sm" role="alert">{t(error)}</p> : null}
    </form>}
  </details>;
}
