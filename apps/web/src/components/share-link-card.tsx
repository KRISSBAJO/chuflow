"use client";

import { useState } from "react";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          ) : null}
          <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {url}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
          >
            Open form
          </a>
        </div>
      </div>
    </section>
  );
}
