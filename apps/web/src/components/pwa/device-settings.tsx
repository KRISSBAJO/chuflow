"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/app/icons";
import { Badge, Button } from "@/components/ui/ui";
import { currentSubscription, disablePush, enablePush, getPushConfig, pushSupported, sendTestPush } from "@/lib/pwa";
import { IOSInstallSteps } from "./app-nudge";
import { promptInstall, useInstallState } from "./install-store";

type PushState = "loading" | "unsupported" | "server-off" | "needs-install" | "blocked" | "off" | "on";

const PUSH_COPY: Record<PushState, string> = {
  loading: "Checking this device...",
  unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or the installed app.",
  "server-off": "Notifications aren't switched on for your workspace yet.",
  "needs-install": "On iPhone and iPad, install ChuFlow to your home screen first, then turn alerts on from the app.",
  blocked: "Notifications are blocked for ChuFlow. Allow them in your browser or phone settings, then come back.",
  off: "New first-timers, follow-ups assigned to you, and reports waiting for your approval.",
  on: "This device gets alerts for new first-timers, your follow-ups and reports waiting for approval.",
};

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
        toast.success("Alerts are off for this device.");
      } else {
        await enablePush();
        setPush("on");
        toast.success("Alerts are on. Send a test to see one.");
      }
    } catch (error) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") setPush("blocked");
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const { delivered } = await sendTestPush();
      if (delivered > 0) toast.success("Test sent. It should arrive in a few seconds.");
      else toast.error("No device received it. Turn alerts off and on again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send a test.");
    } finally {
      setBusy(false);
    }
  }

  const canToggle = push === "on" || push === "off";

  return (
    <div className="app-card divide-y divide-black/[0.06] rounded-2xl p-5 sm:p-6">
      <Row
        icon="device"
        title="ChuFlow app"
        status={install.installed ? <Badge tone="success" dot>Installed</Badge> : <Badge>Not installed</Badge>}
      >
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">
          {install.installed
            ? "You're using the installed app. It opens full screen from your home screen or dock."
            : "Install ChuFlow on this phone or computer for one-tap access, full-screen pages and alerts. No app store needed."}
        </p>
        {!install.installed && install.canPrompt ? (
          <Button size="sm" className="mt-3" onClick={() => void promptInstall()}>
            Install ChuFlow
          </Button>
        ) : null}
        {!install.installed && install.manualIOS ? (
          <>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShowSteps((value) => !value)}>
              {showSteps ? "Hide steps" : "How to install on iPhone"}
            </Button>
            {showSteps ? <IOSInstallSteps className="mt-4" /> : null}
          </>
        ) : null}
        {!install.installed && !install.canPrompt && !install.manualIOS ? (
          <p className="mt-2 text-[13px] text-[#8a8780]">
            Look for the install icon in your browser&apos;s address bar, or use &ldquo;Add to Home Screen&rdquo; from its menu.
          </p>
        ) : null}
      </Row>

      <Row
        icon="bell"
        title="Notifications"
        status={
          push === "on" ? (
            <Badge tone="success" dot>On</Badge>
          ) : push === "blocked" ? (
            <Badge tone="danger">Blocked</Badge>
          ) : push === "loading" ? null : (
            <Badge>Off</Badge>
          )
        }
      >
        <p className="mt-1 text-[14px] leading-[1.6] text-[#6b6b6b]">{PUSH_COPY[push]}</p>
        {canToggle ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={push === "on" ? "secondary" : "primary"} onClick={() => void toggle()} disabled={busy}>
              {push === "on" ? "Turn off on this device" : "Turn on alerts"}
            </Button>
            {push === "on" ? (
              <Button size="sm" variant="ghost" onClick={() => void test()} disabled={busy}>
                Send a test
              </Button>
            ) : null}
          </div>
        ) : null}
      </Row>
    </div>
  );
}
