"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button } from "@/components/ui/ui";
import { currentSubscription, disablePush, enablePush, getPushConfig, pushSupported, sendTestPush } from "@/lib/pwa";
import { IOSInstallSteps } from "./app-nudge";
import { promptInstall, useInstallState } from "./install-store";

type PushState = "loading" | "unsupported" | "server-off" | "needs-install" | "blocked" | "off" | "on";

function Row({ icon, title, status, children }: { icon: "device" | "bell"; title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--lp-ink)] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-[var(--lp-ink)]">{title}</p>
          {status}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Settings → This device: install state and push notifications for the phone or browser in hand. */
export function DeviceSettings() {
  const t = useTranslations("admin.pwa.device");
  const install = useInstallState();
  const [push, setPush] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      let next: PushState;
      if (!pushSupported()) {
        next = install.manualIOS ? "needs-install" : "unsupported";
      } else if (!(await getPushConfig()).enabled) {
        next = "server-off";
      } else if (Notification.permission === "denied") {
        next = "blocked";
      } else {
        next = Notification.permission === "granted" && (await currentSubscription()) ? "on" : "off";
      }
      if (active) setPush(next);
    }
    void load();
    return () => {
      active = false;
    };
  }, [install.manualIOS]);

  async function toggle() {
    setBusy(true);
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
        toast.success(t("alertsOff"));
      } else {
        await enablePush();
        setPush("on");
        toast.success(t("alertsOnTest"));
      }
    } catch (error) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") setPush("blocked");
      toast.error(error instanceof Error ? error.message : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const { delivered } = await sendTestPush();
      if (delivered > 0) toast.success(t("testSent"));
      else toast.error(t("testNotReceived"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("testError"));
    } finally {
      setBusy(false);
    }
  }

  const canToggle = push === "on" || push === "off";

  return (
    <div className="app-card divide-y divide-black/[0.06] rounded-2xl p-5 sm:p-6">
      <Row
        icon="device"
        title={t("appTitle")}
        status={install.installed ? <Badge tone="success" dot>{t("installed")}</Badge> : <Badge>{t("notInstalled")}</Badge>}
      >
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          {install.installed
            ? t("installedBody")
            : t("installBody")}
        </p>
        {!install.installed && install.canPrompt ? (
          <Button size="sm" className="mt-3" onClick={() => void promptInstall()}>
            {t("installButton")}
          </Button>
        ) : null}
        {!install.installed && install.manualIOS ? (
          <>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShowSteps((value) => !value)}>
              {showSteps ? t("hideSteps") : t("howToInstallIphone")}
            </Button>
            {showSteps ? <IOSInstallSteps className="mt-4" /> : null}
          </>
        ) : null}
        {!install.installed && !install.canPrompt && !install.manualIOS ? (
          <p className="mt-2 text-[13px] text-[#8a8780]">
            {t("lookForInstallIcon")}
          </p>
        ) : null}
      </Row>

      <Row
        icon="bell"
        title={t("notifications")}
        status={
          push === "on" ? (
            <Badge tone="success" dot>{t("on")}</Badge>
          ) : push === "blocked" ? (
            <Badge tone="danger">{t("blocked")}</Badge>
          ) : push === "loading" ? null : (
            <Badge>{t("off")}</Badge>
          )
        }
      >
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">{t(`pushCopy.${push}`)}</p>
        {canToggle ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={push === "on" ? "secondary" : "primary"} onClick={() => void toggle()} disabled={busy}>
              {push === "on" ? t("turnOff") : t("turnOn")}
            </Button>
            {push === "on" ? (
              <Button size="sm" variant="ghost" onClick={() => void test()} disabled={busy}>
                {t("sendTest")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Row>
    </div>
  );
}
