"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function TemplateQrCard({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(url, {
      margin: 1,
      width: 200,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((result) => {
        if (active) {
          setQrDataUrl(result);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 break-all text-xs text-slate-500">{url}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-4">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR code for ${title}`} className="h-28 w-28 rounded-xl border border-slate-200 bg-white p-2" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
            QR loading
          </div>
        )}
        <div className="space-y-2 text-sm text-slate-600">
          <p>Scan this QR code to open the public form instantly.</p>
          <p>Perfect for a screen slide, standee, or printed intake desk card.</p>
        </div>
      </div>
    </section>
  );
}
