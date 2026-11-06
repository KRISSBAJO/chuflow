"use client";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { LanguagePicker } from "@/components/i18n/language-picker";
import { API_URL } from "@/lib/api";
import { flowCopy } from "./flow-copy";
import { ChildrenSelection } from "./selection";
import { ChildrenReceipt } from "./receipt";
import { CameraScan } from "./camera-scan";
import type { FamilySelection, ReceiptData } from "@/lib/children";
const copy = {
  en: {
    welcome: "A big welcome for little people.",
    subtitle:
      "We’re so happy you’re here. Scan your family or child card to get started.",
    scan: "Scan your family card",
    placeholder: "Scan QR code here…",
    continue: "Find my family",
    camera: "Use camera",
    reset: "Start again",
    help: "First visit or forgotten card? Our welcome team is here to help.",
    a: "Scan your card",
    b: "Choose your children",
    c: "Keep your pickup receipt",
    closed: "Please ask the welcome team to open this kiosk.",
  },
  es: {
    welcome: "Una gran bienvenida para los pequeños.",
    subtitle:
      "Nos alegra verte. Escanea la tarjeta familiar o del niño para comenzar.",
    scan: "Escanea tu tarjeta familiar",
    placeholder: "Escanea el código QR aquí…",
    continue: "Buscar mi familia",
    camera: "Usar cámara",
    reset: "Volver a empezar",
    help: "¿Primera visita o no tienes tarjeta? Nuestro equipo te ayudará.",
    a: "Escanea tu tarjeta",
    b: "Elige a tus niños",
    c: "Guarda el comprobante de recogida",
    closed: "Pide al equipo de bienvenida que abra este quiosco.",
  },
  fr: {
    welcome: "Un grand accueil pour les petits.",
    subtitle:
      "Nous sommes heureux de vous voir. Scannez la carte de votre famille ou de votre enfant.",
    scan: "Scannez votre carte familiale",
    placeholder: "Scannez le code QR ici…",
    continue: "Trouver ma famille",
    camera: "Utiliser la caméra",
    reset: "Recommencer",
    help: "Première visite ou carte oubliée ? Notre équipe est là pour vous aider.",
    a: "Scannez votre carte",
    b: "Choisissez vos enfants",
    c: "Gardez votre reçu de sortie",
    closed: "Demandez à l’équipe d’accueil d’ouvrir cette borne.",
  },
  pt: {
    welcome: "Uma grande recepção para os pequenos.",
    subtitle:
      "Que bom ter você aqui. Leia o cartão da família ou da criança para começar.",
    scan: "Leia seu cartão da família",
    placeholder: "Leia o código QR aqui…",
    continue: "Encontrar minha família",
    camera: "Usar câmera",
    reset: "Começar de novo",
    help: "Primeira visita ou esqueceu o cartão? Nossa equipe pode ajudar.",
    a: "Leia seu cartão",
    b: "Escolha suas crianças",
    c: "Guarde o comprovante de retirada",
    closed: "Peça à equipe de recepção para abrir este quiosque.",
  },
};
export function ChildrenKiosk({ token }: { token: string }) {
  const locale = useLocale(),
    t = copy[locale as keyof typeof copy] || copy.en;
  const [info, setInfo] = useState<{
      churchName: string;
      sessionName: string;
    } | null>(null),
    [selection, setSelection] = useState<FamilySelection | null>(null),
    [receipt, setReceipt] = useState<ReceiptData | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const flow = flowCopy[locale as keyof typeof flowCopy] || flowCopy.en;
  const generation = useRef(0);
  const reset = useCallback(() => {
    generation.current++;
    setBusy(false);
    setSelection(null);
    setReceipt(null);
    setCode("");
    setError("");
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
      if (!response.ok)
        throw new Error(
          result.message || "Please ask the welcome team for help.",
        );
      return result as T;
    },
    [token],
  );
  useEffect(() => {
    let active = true;
    void request<{ churchName: string; sessionName: string }>("")
      .then((r) => {
        if (active) setInfo(r);
      })
      .catch(() => {
        if (active) setError(t.closed);
      });
    return () => {
      active = false;
    };
  }, [request, t.closed]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const touch = () => {
      clearTimeout(timeout);
      timeout = setTimeout(reset, 90000);
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
        setError(e instanceof Error ? e.message : t.closed);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void scan(code);
  }
  return (
    <div className="children-workspace min-h-screen">
      <header className="children-wrap flex items-center justify-between gap-4">
        <p className="text-2xl font-bold tracking-tight">
          ChuFlow{" "}
          <span className="rounded-xl bg-[#ffdda4] px-2 text-[#7b4c24]">
            Kids
          </span>
        </p>
        <LanguagePicker />
      </header>
      <main className="children-wrap max-w-6xl space-y-6">
        {!selection && !receipt ? (
          <>
            <section className="children-hero">
              <div className="children-hero-copy">
                <p className="children-kicker mb-4">
                  {info?.churchName || "Children’s ministry"}
                </p>
                <h1 className="children-title">{t.welcome}</h1>
                <p className="mt-5 text-base leading-7 text-[#5e6b59]">
                  {t.subtitle}
                </p>
                {info && (
                  <p className="mt-4 text-sm font-semibold">
                    {info.sessionName}
                  </p>
                )}
              </div>
              <Image
                src="/children/welcome.png"
                width={1752}
                height={896}
                alt="Children welcomed into a friendly classroom"
                priority
              />
            </section>
            <section className="children-grid items-start">
              <form className="children-panel space-y-4" onSubmit={submit}>
                <h2 className="text-2xl font-bold">{t.scan}</h2>
                <input
                  className="children-input text-lg"
                  aria-label={t.scan}
                  autoFocus
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t.placeholder}
                  required
                />
                <button
                  className="children-button w-full text-lg"
                  type="submit"
                  disabled={busy || !info}
                >
                  {busy ? "…" : t.continue}
                </button>
                <CameraScan
                  label={t.camera}
                  onCode={(value) => void scan(value)}
                />
              </form>
              <section className="children-panel">
                <ol className="space-y-4">
                  {[t.a, t.b, t.c].map((label, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8dfae] text-xl font-bold">
                        {"ABC"[i]}
                      </span>
                      <span className="text-lg font-semibold">{label}</span>
                    </li>
                  ))}
                </ol>
                <p className="children-muted mt-6">{t.help}</p>
              </section>
            </section>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="children-kicker">{info?.sessionName}</p>
              <button
                type="button"
                className="children-button secondary"
                onClick={reset}
              >
                {t.reset}
              </button>
            </div>
            {receipt ? (
              <ChildrenReceipt data={receipt} onDone={reset} text={flow} />
            ) : (
              selection && (
                <ChildrenSelection
                  text={flow}
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
          </>
        )}
        {error && (
          <p role="alert" className="children-error">
            {error}
          </p>
        )}
      </main>
      <footer className="children-wrap text-center children-muted">
        {t.help}
      </footer>
    </div>
  );
}
