"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useFlowText } from "./flow-copy";
import type { ReceiptData } from "@/lib/children";
/** QR image for a card, receipt or kiosk link. */
export function ChildrenQr({
  code,
  size = 160,
  alt,
}: {
  code: string;
  size?: number;
  alt?: string;
}) {
  const t = useTranslations("childrenDesk.flow");
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(code, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [code]);
  return src ? (
    <Image
      width={size}
      height={size}
      unoptimized
      className="children-card-qr"
      style={{ width: size, height: size }}
      src={src}
      alt={alt || t("qrAlt")}
    />
  ) : (
    <span
      className="children-muted inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {t("qrPreparing")}
    </span>
  );
}
/** Printable pickup receipt + one label per child. */
export function ChildrenReceipt({
  data,
  onDone,
}: {
  data: ReceiptData;
  onDone?: () => void;
}) {
  const text = useFlowText();
  return (
    <div className="children-panel kids-fade-in">
      <div data-children-labels>
        <section className="children-print-label">
          <p className="children-kicker">{text.receipt}</p>
          <h2 className="mt-2 text-2xl font-bold">{text.keep}</h2>
          <p className="children-muted">{data.sessionName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <ChildrenQr code={data.code} />
            <div>
              <p className="text-3xl font-bold tracking-widest">
                {data.display}
              </p>
              <p className="children-muted mt-2">
                {text.present}
                <br />
                {text.authorized}
              </p>
            </div>
          </div>
        </section>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.children.map((c, i) => (
            <section
              key={i}
              className="children-print-label rounded-xl border border-dashed border-[#d5dccf] p-4"
            >
              <p className="text-2xl font-bold">{c.name}</p>
              <p className="mt-2 text-lg">{c.room}</p>
              <p className="mt-3 font-mono text-xl">{data.display}</p>
              {c.careAlert && (
                <p className="children-badge rose mt-2">{text.care}</p>
              )}
            </section>
          ))}
        </div>
      </div>
      <div data-no-print className="mt-5 flex flex-wrap gap-3">
        <button
          className="children-button"
          type="button"
          onClick={() => window.print()}
        >
          <span aria-hidden="true">🖨</span> {text.print}
        </button>
        {onDone && (
          <button
            className="children-button secondary"
            type="button"
            autoFocus
            onClick={onDone}
          >
            {text.done}
          </button>
        )}
      </div>
    </div>
  );
}
/** Issues (or replaces) a permanent family / child identification card. */
export function ChildrenCardButton({
  kind,
  id,
}: {
  kind: "family" | "child";
  id: string;
}) {
  const t = useTranslations("childrenDesk.card");
  const [card, setCard] = useState<{ code: string; name: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const { apiPost } = await import("@/lib/api");
      setCard(
        await apiPost(
          `/children/${kind === "family" ? "families" : "profiles"}/${id}/card`,
          {},
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="children-button secondary"
        type="button"
        disabled={busy}
        onClick={generate}
      >
        {busy
          ? t("preparing")
          : kind === "family"
            ? t("issueFamily")
            : t("issueChild")}
      </button>
      <p className="children-muted mt-2">{t("note")}</p>
      {error && (
        <p role="alert" className="children-error">
          {error}
        </p>
      )}
      {card && (
        <div className="children-panel mt-4">
          <div data-children-labels className="children-print-label">
            <p className="children-kicker">{t("kicker")}</p>
            <p className="mt-2 text-xl font-semibold">{card.name}</p>
            <ChildrenQr code={card.code} />
            <p className="children-muted">{t("checkInOnly")}</p>
          </div>
          <button
            data-no-print
            className="children-button mt-3"
            type="button"
            onClick={() => window.print()}
          >
            {t("print")}
          </button>
        </div>
      )}
    </div>
  );
}
