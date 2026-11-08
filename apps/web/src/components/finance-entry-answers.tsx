"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MemberAnswersEditor } from "@/components/member-custom-fields";
import { API_URL } from "@/lib/api";
import type { GuestCustomAnswer } from "@/lib/guest-fields";

export function FinanceEntryAnswers({ kind, id, editable }: { kind: "offering" | "expense"; id: string; editable: boolean }) {
  const [answers, setAnswers] = useState<GuestCustomAnswer[]>();
  const [revision, setRevision] = useState<number>();
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const t = useTranslations("admin.settings.guestFields");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_URL}/finance/${kind}s/${id}`, { credentials: "include", signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { customAnswers?: GuestCustomAnswer[]; reviewRevision?: number };
        setRevision(data.reviewRevision);
        setAnswers(data.customAnswers ?? []);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [kind, id]);
  if (failed) return <p role="alert" className="py-3 text-sm">{t("financeLoadFailed")}</p>;
  if (!answers) return null;
  return <MemberAnswersEditor id={id} answers={answers} editable={editable} financeKind={kind} reviewRevision={revision} onSaved={() => router.refresh()} />;
}

export function FinanceReviewAnswers({ id }: { id: string }) {
  const t = useTranslations("admin.settings.guestFields");
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="my-3 text-sm">
      <summary className="cursor-pointer">{t("financeAnswers")}</summary>
      {open ? <FinanceEntryAnswers kind="offering" id={id} editable={false} /> : null}
    </details>
  );
}
