"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { MemberAnswersEditor } from "@/components/member-custom-fields";
import type { GuestCustomAnswer } from "@/lib/guest-fields";

export function ServiceUnitAnswers({ id, editable }: { id: string; editable: boolean }) {
  const [answers, setAnswers] = useState<GuestCustomAnswer[]>();
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`${API_URL}/service-units/${id}`, { credentials: "include", cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { customAnswers?: GuestCustomAnswer[] };
        setAnswers(result.customAnswers ?? []);
      }).catch(() => {});
    return () => abort.abort();
  }, [id]);
  return answers ? <MemberAnswersEditor id={id} answers={answers} editable={editable} serviceUnit /> : null;
}
