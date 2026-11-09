"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/app/icons";
import { Alert, SubmitButton } from "@/components/auth/auth-ui";
import { Wordmark } from "@/components/brand/wordmark";

const subscribe = () => () => {};

function browserHandoff() {
  return window.location.hash.slice(1);
}

export function MobileBrowserHandoff() {
  const hash = useSyncExternalStore(subscribe, browserHandoff, () => null);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("auth.workspacePicker");
  const tc = useTranslations("common");
  const params = new URLSearchParams(hash ?? "");
  const handoff = params.get("handoff");
  const workspace = params.get("workspace");

  return (
    <div className="lp-root flex min-h-dvh flex-col">
      <header className="flex h-20 items-center border-b border-black/[.06] px-6 sm:px-10">
        <Wordmark size={22} href={null} />
      </header>
      <main className="mx-auto w-full max-w-md px-5 pb-12 pt-10 sm:px-6 sm:pt-16" aria-busy={hash === null}>
        <section className="space-y-5 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="lp-heading text-[1.85rem] leading-tight">{t("open")}</h1>
          {handoff && workspace ? (
            <>
              <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-[var(--lp-panel)] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#9a3412]">
                  <Icon name="branches" />
                </span>
                <p className="min-w-0 break-words text-sm font-semibold">{params.get("name") || workspace}</p>
              </div>
              <form method="post" action="/api/workspace-session" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="browser" value="1" />
                <input type="hidden" name="workspace" value={workspace} />
                <input type="hidden" name="handoff" value={handoff} />
                <input type="hidden" name="returnTo" value={params.get("returnTo") ?? ""} />
                <SubmitButton loading={submitting} loadingLabel={t("open")}>{t("open")}</SubmitButton>
              </form>
            </>
          ) : hash !== null ? (
            <>
              <Alert tone="info">{t("failed")}</Alert>
              <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">{tc("signIn")}</Link>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
