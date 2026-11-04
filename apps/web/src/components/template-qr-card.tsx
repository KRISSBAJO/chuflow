"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { localizedFormUrl, type FormLanguage } from "@/lib/form-language";
import { Button } from "@/components/ui/ui";

export function TemplateQrCard({
  url,
  title,
  allowSpanish = false,
}: {
  url: string;
  title: string;
  allowSpanish?: boolean;
}) {
  const [language, setLanguage] = useState<FormLanguage>("en");
  const shareUrl = allowSpanish ? localizedFormUrl(url, language) : url;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 200,
      color: {
        dark: "#111111",
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
  }, [shareUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#111111]">{title}</p>
          <p className="mt-0.5 break-all text-[12px] leading-[1.5] text-[#8a8780]">
            {shareUrl}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      {allowSpanish && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          Share form in
          <select
            className="rounded-xl border border-black/10 bg-white px-3 py-2"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as FormLanguage);
              setCopied(false);
              setQrDataUrl(null);
            }}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      )}
      <div className="mt-4 flex items-center gap-4">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for ${title}`}
            className="h-28 w-28 shrink-0 rounded-xl border border-black/[0.06] bg-white p-2"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[12px] text-[#8a8780]">
            Loading QR
          </div>
        )}
        <div className="space-y-1.5 text-[13px] leading-[1.6] text-[#6b6b6b]">
          <p>Scan this code to open the public form instantly.</p>
          <p>Great for a screen slide, standee or printed welcome desk card.</p>
        </div>
      </div>
    </section>
  );
}
