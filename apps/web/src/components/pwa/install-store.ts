"use client";

import { useSyncExternalStore } from "react";
import { isIOS, isStandalone } from "@/lib/pwa";

/*
 * Chrome and Edge fire `beforeinstallprompt` once, often before the signed-in shell has mounted.
 * PwaRoot catches it here so any later screen can offer a one-tap install.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = {
  /** Already running as an installed app. */
  installed: boolean;
  /** The browser handed us a native install prompt. */
  canPrompt: boolean;
  /** iPhone/iPad Safari: install is manual (Share → Add to Home Screen). */
  manualIOS: boolean;
};

const SERVER_STATE: InstallState = { installed: false, canPrompt: false, manualIOS: false };

let deferred: InstallPromptEvent | null = null;
let state: InstallState = SERVER_STATE;
const listeners = new Set<() => void>();

function update(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function initInstallStore() {
  const installed = isStandalone();
  update({ installed, manualIOS: !installed && isIOS() });

  const onPrompt = (event: Event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    update({ canPrompt: true });
  };
  const onInstalled = () => {
    deferred = null;
    update({ installed: true, canPrompt: false, manualIOS: false });
  };

  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  update({ canPrompt: false });
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === "accepted";
}

export function useInstallState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => SERVER_STATE,
  );
}
