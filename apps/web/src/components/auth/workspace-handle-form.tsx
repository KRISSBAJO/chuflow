"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, SubmitButton } from "@/components/auth/auth-ui";

/** Opens a provisioned church's own sign-in page from the handle in its welcome message. */
export function WorkspaceHandleForm() {
  const t = useTranslations("auth.workspacePicker");
  const [handle, setHandle] = useState("");
  const slug = handle.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

  return (
    <form action="/login" method="get" className="space-y-4">
      <Field label={t("handle")} hint={t("handleHint")}>
        <input
          name="workspace"
          value={slug === handle ? handle : slug}
          onChange={(event) => setHandle(event.target.value)}
          placeholder={t("handlePlaceholder")}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          minLength={3}
          maxLength={64}
          className="lp-input"
          required
        />
      </Field>
      <SubmitButton loading={false} loadingLabel={t("open")}>
        {t("open")}
      </SubmitButton>
    </form>
  );
}
