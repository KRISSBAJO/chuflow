"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { API_URL } from "@/lib/api";

export function WorkspaceHandoffButton({
  id,
  name,
  destination,
}: {
  id: string;
  name: string;
  destination: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useTranslations("auth.workspacePicker");

  async function switchWorkspace() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`${API_URL}/auth/workspaces/${encodeURIComponent(id)}/handoff`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Workspace handoff failed");
      const { handoff } = await response.json();
      if (typeof handoff !== "string") throw new Error("Missing workspace handoff");
      const form = document.createElement("form");
      form.method = "POST";
      form.action = destination;
      form.hidden = true;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "handoff";
      input.value = handoff;
      form.append(input);
      if (destination === "/api/workspace-session") {
        const workspace = document.createElement("input");
        workspace.type = "hidden";
        workspace.name = "workspace";
        workspace.value = id;
        form.append(workspace);
      }
      document.body.append(form);
      form.submit();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={switchWorkspace}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-4 text-left font-medium hover:bg-[var(--lp-panel)] disabled:opacity-60"
      >
        {name}<span aria-hidden="true">&rarr;</span>
      </button>
      {failed && <p role="alert" className="mt-2 text-sm text-red-700">{t("failed")}</p>}
    </>
  );
}
