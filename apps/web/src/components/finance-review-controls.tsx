"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";

export function FinanceReviewControls({ id, status, canReview, reviewRevision, kind = "offerings", onReviewed }: {
  id: string; status?: string; canReview?: boolean; reviewRevision?: number; kind?: "offerings" | "expenses"; onReviewed?:()=>void;
}) {
  const t = useTranslations("admin.financeReview");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  if (status !== "submitted") return null;
  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/finance/${kind}/${id}/${decision}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, reviewRevision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : t("failed"));
      toast.success(t(decision === "approve" ? "approved" : "rejected"));
      onReviewed?.();
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("failed")); }
    finally { setBusy(false); }
  }
  return <div className="mb-5 space-y-3 rounded-xl border border-black/10 bg-white p-4">
    <p className="text-sm text-[#6b6b6b]">{t("independent")}</p>
    {canReview && <><Field label={t("notes")}><textarea className="ui-input" value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></Field>
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => decide("approve")}>{t("approve")}</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => decide("reject")}>{t("reject")}</Button></div></>}
  </div>;
}
