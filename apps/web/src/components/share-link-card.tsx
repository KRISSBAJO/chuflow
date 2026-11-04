"use client";

import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/ui";

export function ShareLinkCard({
  title,
  url,
  description,
}: {
  title: string;
  url: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#111111]">{title}</p>
          {description ? (
            <p className="mt-1 text-[13px] leading-[1.5] text-[#6b6b6b]">{description}</p>
          ) : null}
          <p className="mt-3 break-all rounded-xl bg-[#f6f5f1] px-3 py-2 font-mono text-[12px] text-[#55534e]">
            {url}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleCopy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a href={url} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
            Open form
          </a>
        </div>
      </div>
    </section>
  );
}
