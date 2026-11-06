"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

/** Card scan box on the home page; hands the code to the session desk, which performs the lookup. */
export function QuickScan({ sessionId }: { sessionId: string }) {
  const t = useTranslations("children.home.scan");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    router.push(
      `/children/sessions/${sessionId}?tab=checkin&code=${encodeURIComponent(value)}`,
    );
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-dashed border-[#d8dccd] bg-white p-4"
    >
      <label className="children-label" htmlFor="kids-quick-scan">
        {t("title")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="kids-quick-scan"
          className="children-input font-mono"
          autoComplete="off"
          placeholder={t("placeholder")}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button
          type="submit"
          className="children-button shrink-0"
          disabled={busy || !code.trim()}
        >
          {t("go")}
        </button>
      </div>
      <p className="children-muted mt-2 !text-xs">{t("hint")}</p>
    </form>
  );
}
