"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import type { BranchSummary } from "@/lib/types";

export function ChurchRecordingLinks({ branches, defaultBranchId, kind }: {
  branches: Pick<BranchSummary, "_id" | "name">[];
  defaultBranchId?: string;
  kind: "finance" | "attendance";
}) {
  const t = useTranslations("recording");
  const [branchId, setBranchId] = useState(branches.find((b) => b._id === defaultBranchId)?. _id || "");
  const href = branchId ? `/record/${encodeURIComponent(branchId)}/${kind}` : "";
  return <details className="mb-5 rounded-2xl border border-black/[0.06] bg-white p-4">
    <summary className="cursor-pointer text-sm font-medium">{t("shareTitle")}</summary>
    <p className="mt-3 text-sm text-[#6b6b6b]">{t("shareHint")}</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <Field label={t("church")} className="min-w-0 flex-1 basis-64">
        <select className="ui-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t("selectChurch")}</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </Field>
      <Button variant="secondary" disabled={!href} onClick={async () => {
        try { await navigator.clipboard.writeText(new URL(href, window.location.origin).href); toast.success(t("copied")); }
        catch { toast.error(t("copyFailed")); }
      }}>{t("copyLink")}</Button>
      {href && <a className="ui-button ui-button-secondary text-sm underline underline-offset-4" href={href} target="_blank" rel="noopener noreferrer">{t("openForm")}</a>}
    </div>
    {href && <input aria-label={t("link")} className="ui-input mt-3" readOnly value={href} onFocus={(e) => e.currentTarget.select()} />}
  </details>;
}
