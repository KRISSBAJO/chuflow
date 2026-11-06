"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";
import { safeReturnTo } from "@/lib/return-to";
import { Button } from "./ui/ui";

export function BackendWakeup({ returnTo }: { returnTo: string }) {
  const t = useTranslations("recording");
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function check() {
      if (stopped) return;
      attempts += 1;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store", signal: controller.signal });
        if ([200, 401, 403].includes(response.status) && response.headers.get("content-type")?.includes("application/json")) {
          if (!stopped) {
            try {
              const previous = JSON.parse(sessionStorage.getItem("chuflow:server-recovery") || "null") as { target: string; time: number; count: number } | null;
              const count = previous?.target === returnTo && Date.now() - previous.time < 180000 ? previous.count : 0;
              if (count >= 2) { setWaiting(false); return; }
              sessionStorage.setItem("chuflow:server-recovery", JSON.stringify({ target: returnTo, time: Date.now(), count: count + 1 }));
            } catch { /* Recovery also works when session storage is unavailable. */ }
            window.location.replace(safeReturnTo(returnTo));
          }
          return;
        }
      } catch { /* Leave the current session intact while the server wakes. */ }
      finally { clearTimeout(timeout); }
      if (stopped) return;
      if (attempts < 18) timer = setTimeout(check, 5000);
      else setWaiting(false);
    }
    void check();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [returnTo]);
  return <div className="mt-6"><p role="status" className="mb-5 text-sm text-[#6b6b6b]">{t(waiting ? "checkingServer" : "serverTakingLonger")}</p><Button onClick={() => window.location.replace(safeReturnTo(returnTo))}>{t("retry")}</Button></div>;
}
