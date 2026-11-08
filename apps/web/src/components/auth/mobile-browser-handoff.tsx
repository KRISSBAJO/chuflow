"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Alert, AuthHeading, SubmitButton } from "@/components/auth/auth-ui";

const subscribe = () => () => {};

function browserHandoff() {
  return window.location.hash.slice(1);
}

export function MobileBrowserHandoff() {
  const hash = useSyncExternalStore(subscribe, browserHandoff, () => "");
  const t = useTranslations("auth.workspacePicker");
  const tc = useTranslations("common");
  const params = new URLSearchParams(hash);
  const handoff = params.get("handoff");
  const workspace = params.get("workspace");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-6">
      {handoff && workspace ? (
        <>
          <AuthHeading title={t("open")} />
          <p>{params.get("name")}</p>
          <form method="post" action="/api/workspace-session">
            <input type="hidden" name="browser" value="1" />
            <input type="hidden" name="workspace" value={workspace} />
            <input type="hidden" name="handoff" value={handoff} />
            <input type="hidden" name="returnTo" value={params.get("returnTo") ?? ""} />
            <SubmitButton loading={false} loadingLabel={t("open")}>{t("open")}</SubmitButton>
          </form>
        </>
      ) : (
        <>
          <Alert tone="info">{t("failed")}</Alert>
          <Link href="/login" className="underline">{tc("signIn")}</Link>
        </>
      )}
    </main>
  );
}
