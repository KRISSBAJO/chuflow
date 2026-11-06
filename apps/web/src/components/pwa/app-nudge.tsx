"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { enablePush, getPushConfig, pushSupported } from "@/lib/pwa";
import { promptInstall, useInstallState } from "./install-store";

const SNOOZE_DAYS = 14;
const INSTALL_KEY = "chuflow.nudge.install";
const PUSH_KEY = "chuflow.nudge.push";

function snoozed(key: string) {
  try {
    const at = Number(window.localStorage.getItem(key));
    return Number.isFinite(at) && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function snooze(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Private mode: the card simply comes back next visit.
  }
}

/** Steps for installing from iPhone/iPad Safari, which has no install button of its own. */
export function IOSInstallSteps({ className = "" }: { className?: string }) {
  const t = useTranslations("admin.pwa.iosSteps");
  const bold = (chunks: React.ReactNode) => <b className="font-medium text-[var(--lp-ink)]">{chunks}</b>;
  return (
    <ol className={`space-y-2.5 text-[14px] leading-[1.5] text-[#55534e] ${className}`}>
      <li className="flex items-start gap-3">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[var(--lp-ink)]">1</span>
        <span>
          {t.rich("share", {
            icon: () => <Icon name="share" className="mx-0.5 inline h-4 w-4 -translate-y-px text-[#0a84ff]" />,
            b: bold,
          })}
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[var(--lp-ink)]">2</span>
        <span>
          {t.rich("addToHome", { b: bold })}
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-[var(--lp-ink)]">3</span>
        <span>{t("openApp")}</span>
      </li>
    </ol>
  );
}

type Nudge = "install" | "push" | null;

/**
 * One gentle card at the top of the signed-in app: first "install the app", then, once it can
 * receive them, "turn on alerts". Each can be snoozed for two weeks.
 */
export function AppNudge() {
  const t = useTranslations("admin.pwa.nudge");
  const install = useInstallState();
  const [pushReady, setPushReady] = useState(false);
  const [hidden, setHidden] = useState<{ install: boolean; push: boolean } | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setHidden({ install: snoozed(INSTALL_KEY), push: snoozed(PUSH_KEY) }));
    if (!pushSupported() || Notification.permission !== "default") return;
    let active = true;
    void getPushConfig().then((config) => {
      if (active) setPushReady(config.enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!hidden) return null;

  let nudge: Nudge = null;
  if (!install.installed && (install.canPrompt || install.manualIOS) && !hidden.install) nudge = "install";
  // iPhones only allow web push from the installed app, so alerts come after install there.
  else if (pushReady && (install.installed || !install.manualIOS) && !hidden.push) nudge = "push";
  if (!nudge) return null;

  function dismiss() {
    snooze(nudge === "install" ? INSTALL_KEY : PUSH_KEY);
    setHidden((current) => (current ? { ...current, [nudge as string]: true } : current));
  }

  async function handleInstall() {
    if (install.manualIOS) {
      setShowSteps((value) => !value);
      return;
    }
    await promptInstall();
  }

  async function handlePush() {
    setBusy(true);
    try {
      await enablePush();
      toast.success(t("alertsOn"));
      setPushReady(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("alertsError"));
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  const copy =
    nudge === "install"
      ? {
          title: t("installTitle"),
          body: t("installBody"),
          action: install.manualIOS ? (showSteps ? t("hideSteps") : t("showMeHow")) : t("install"),
        }
      : {
          title: t("pushTitle"),
          body: t("pushBody"),
          action: busy ? t("turningOn") : t("turnOn"),
        };

  return (
    <div className="app-rise app-card relative overflow-hidden rounded-2xl p-4 sm:p-5" role="region" aria-label={copy.title}>
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--lp-ink)] text-white shadow-[0_8px_20px_-10px_rgba(17,17,17,0.6)]">
          <Icon name={nudge === "install" ? "device" : "bell"} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[var(--lp-ink)]">{copy.title}</p>
          <p className="mt-0.5 text-[13.5px] leading-[1.55] text-[#6b6b6b]">{copy.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={nudge === "install" ? handleInstall : handlePush}
              disabled={busy}
              className="lp-pill-dark inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium disabled:opacity-60"
            >
              {copy.action}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center rounded-full px-3 text-[13.5px] font-medium text-[#6b6b6b] hover:text-[var(--lp-ink)]"
            >
              {t("notNow")}
            </button>
          </div>
          {nudge === "install" && showSteps ? <IOSInstallSteps className="mt-4" /> : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a8780] hover:bg-black/[0.04] hover:text-[var(--lp-ink)]"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
