"use client";

import { API_URL } from "@/lib/api";

/*
 * Browser helpers for the installable app: service worker, install state and web push.
 * The API owns the VAPID keys and the subscription list; the browser only asks for permission
 * and hands its subscription over.
 */

type PushConfig = { enabled: boolean; publicKey: string | null };

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac, so also check for touch.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

let configPromise: Promise<PushConfig> | null = null;

export function getPushConfig() {
  configPromise ??= fetch(`${API_URL}/push/config`, { credentials: "include" })
    .then((response) => (response.ok ? (response.json() as Promise<PushConfig>) : { enabled: false, publicKey: null }))
    .catch(() => {
      configPromise = null;
      return { enabled: false, publicKey: null };
    });
  return configPromise;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function registration() {
  return navigator.serviceWorker.ready;
}

async function sendToServer(subscription: PushSubscription) {
  const response = await fetch(`${API_URL}/push/subscriptions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Couldn't save this device for notifications.");
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks for permission (must run from a tap) and registers this device with the API. */
export async function enablePush() {
  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error("Notifications aren't set up on the server yet.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Allow them for ChuFlow in your browser or phone settings."
        : "Notifications were not turned on.",
    );
  }

  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));
  await sendToServer(subscription);
  return subscription;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await forgetOnServer(subscription.endpoint);
  await subscription.unsubscribe();
}

/** Removes this device from the signed-in user's list (used on sign out, keeps the browser subscription). */
export async function forgetDeviceOnServer() {
  try {
    const subscription = await currentSubscription();
    if (subscription) await forgetOnServer(subscription.endpoint);
  } catch {
    // Signing out must never fail because of notifications.
  }
}

async function forgetOnServer(endpoint: string) {
  await fetch(`${API_URL}/push/subscriptions`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

/**
 * Re-links this device to whoever is signed in, and quietly renews a subscription the browser
 * dropped. Runs on every app load; does nothing unless permission was already granted.
 */
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const config = await getPushConfig();
  if (!config.enabled) return;
  try {
    await enablePush();
  } catch {
    // Best effort: the settings switch shows the real state.
  }
}

export async function sendTestPush() {
  const response = await fetch(`${API_URL}/push/test`, { method: "POST", credentials: "include" });
  if (!response.ok) throw new Error("Couldn't send a test notification.");
  return (await response.json()) as { delivered: number };
}
