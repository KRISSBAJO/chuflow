"use client";

import { useEffect } from "react";
import { initInstallStore } from "./install-store";

/** Mounted once in the root layout: registers the service worker and listens for install events. */
export function PwaRoot() {
  useEffect(() => {
    const cleanup = initInstallStore();

    // In development the worker would cache stale bundles between edits, so only run it in builds.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => undefined);
    }

    return cleanup;
  }, []);

  return null;
}
