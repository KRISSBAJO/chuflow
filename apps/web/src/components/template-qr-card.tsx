"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/ui";

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
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#111111]">{title}</p>
          <p className="mt-0.5 break-all text-[12px] leading-[1.5] text-[#8a8780]">{url}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
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
