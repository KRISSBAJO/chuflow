"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { API_URL } from "@/lib/api";
import { useFlowText } from "./flow-copy";
import { ChildrenSelection } from "./selection";
import { ChildrenReceipt } from "./receipt";
import { CameraScan } from "./camera-scan";
import type { FamilySelection, ReceiptData } from "@/lib/children";
/** Idle time before the tablet quietly returns to the welcome screen. */
const IDLE_MS = 90000;
const STEP_TONES = ["kids-avatar", "kids-avatar green", "kids-avatar blue"];
/**
 * Public self-service welcome kiosk for a tablet in the lobby. Authenticated only
 * by the short-lived kiosk token in the URL; never shows the staff roster.
 */
export function ChildrenKiosk({ token }: { token: string }) {
  const t = useTranslations("childrenDesk.kiosk");
  const flow = useFlowText();
  const [info, setInfo] = useState<{
      churchName: string;
      sessionName: string;
    } | null>(null),
    [selection, setSelection] = useState<FamilySelection | null>(null),
    [receipt, setReceipt] = useState<ReceiptData | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const reset = useCallback(() => {
    generation.current++;
    setBusy(false);
    setSelection(null);
    setReceipt(null);
    setCode("");
    setError("");
    setTimeout(() => input.current?.focus(), 0);
  }, []);
  const request = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const response = await fetch(`${API_URL}/children-kiosk${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "x-children-kiosk": token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "omit",
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || t("closed"));
      return result as T;
    },
    [token, t],
  );
  useEffect(() => {
    let active = true;
    void request<{ churchName: string; sessionName: string }>("")
      .then((r) => {
        if (active) setInfo(r);
      })
      .catch(() => {
        if (active) setError(t("closed"));
      });
    return () => {
      active = false;
    };
  }, [request, t]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const touch = () => {
      clearTimeout(timeout);
      timeout = setTimeout(reset, IDLE_MS);
    };
    touch();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [reset]);
  async function scan(value: string) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setCode(value);
    try {
      const result = await request<FamilySelection>("/scan", {
        code: value.trim(),
      });
      if (current === generation.current) setSelection(result);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : t("closed"));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void scan(code);
  }
  const steps = [
    [t("a"), t("aBody")],
    [t("b"), t("bBody")],
    [t("c"), t("cBody")],
  ];
  const welcome = !selection && !receipt;
  return (
    <div className="children-workspace min-h-screen">
      <header className="children-wrap flex items-center justify-between gap-4">
        <p className="text-2xl font-bold tracking-tight">
          {t("brand")}{" "}
          <span className="rounded-xl bg-[#ffdda4] px-2 text-[#7b4c24]">
            {t("brandAccent")}
          </span>
        </p>
        <LanguagePicker />
      </header>
      <main className="children-wrap max-w-6xl space-y-6">
        {welcome ? (
          <>
            <section className="children-hero kids-fade-in">
              <div className="children-hero-copy">
                <p className="children-kicker mb-4">
                  {info?.churchName || t("ministry")}
                </p>
                <h1 className="children-title">{t("welcome")}</h1>
                <p className="mt-5 text-lg leading-8 text-[#5e6b59]">
                  {t("subtitle")}
                </p>
                {info && (
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold">
                    <span className="kids-live-dot" aria-hidden="true" />
                    {info.sessionName}
                  </p>
                )}
              </div>
              <Image
                src="/children/welcome.png"
                width={1752}
                height={896}
                alt={t("heroAlt")}
                priority
              />
            </section>
            <section className="children-grid items-start">
              <form
                className="children-panel space-y-4"
                onSubmit={submit}
                aria-busy={busy}
              >
                <p className="children-kicker">{t("a")}</p>
                <h2 className="text-2xl font-bold">{t("scan")}</h2>
                <input
                  ref={input}
                  className="children-input lg font-mono"
                  aria-label={t("scan")}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("placeholder")}
                  required
                />
                <button
                  className="children-button lg w-full"
                  type="submit"
                  disabled={busy || !info}
                >
                  {busy ? t("finding") : t("continue")}
                </button>
                <CameraScan
                  label={t("camera")}
                  className="children-button secondary lg w-full"
                  onCode={(value) => void scan(value)}
                />
              </form>
              <section className="children-panel">
                <p className="children-kicker">{t("stepsTitle")}</p>
                <ol className="mt-4 space-y-5">
                  {steps.map(([label, body], i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span
                        className={`${STEP_TONES[i]} h-12 w-12 text-xl`}
                        aria-hidden="true"
                      >
                        {"ABC"[i]}
                      </span>
                      <span>
                        <span className="block text-lg font-semibold">
                          {label}
                        </span>
                        <span className="children-muted block">{body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="children-muted mt-6">{t("help")}</p>
              </section>
            </section>
          </>
        ) : (
          <div className="space-y-5 kids-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="children-kicker">{info?.sessionName}</p>
                <p className="mt-1 text-sm font-semibold text-[#5e6b59]">
                  {receipt ? t("stepC") : t("stepB")}
                </p>
              </div>
              <button
                type="button"
                className="children-button secondary lg"
                onClick={reset}
              >
                {t("reset")}
              </button>
            </div>
            {receipt ? (
              <ChildrenReceipt data={receipt} onDone={reset} />
            ) : (
              selection && (
                <ChildrenSelection
                  publicMode
                  key={selection.familyId}
                  selection={{ ...selection, name: flow.family }}
                  onSubmit={async (body) => {
                    const current = generation.current;
                    const r = await request<ReceiptData>("/check-in", {
                      ...body,
                      code: code.trim(),
                    });
                    if (current !== generation.current) return;
                    setReceipt(r);
                    setSelection(null);
                    setCode("");
                  }}
                />
              )
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="children-error text-base">
            {error}
          </p>
        )}
      </main>
      <footer className="children-wrap space-y-1 text-center">
        <p className="children-muted">{t("help")}</p>
        <p className="text-xs text-[#8a9589]">{t("idle")}</p>
      </footer>
    </div>
  );
}
