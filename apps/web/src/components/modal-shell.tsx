"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ModalShell({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  maxWidthClass = "max-w-5xl",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  // Rendered at <body> level so transformed ancestors (animated cards) can't trap the fixed overlay.
  return createPortal(
    <div className="lp-root app-modal fixed inset-0 z-[60] overflow-y-auto px-4 py-6 sm:py-10" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop is not clickable on purpose: a stray click must not discard a half-filled form. */}
      <div aria-hidden className="app-fade fixed inset-0 bg-[#111111]/40 backdrop-blur-[3px]" />
      <div className="relative flex min-h-full items-start justify-center">
        <div className={`app-pop relative w-full ${maxWidthClass} overflow-hidden rounded-[28px] bg-white shadow-[0_40px_100px_-30px_rgba(17,17,17,0.45)]`}>
          <div className="flex items-start justify-between gap-4 border-b border-black/[0.06] px-6 py-5 sm:px-7">
            <div className="min-w-0">
              <p className="lp-label">{eyebrow}</p>
              <h2 className="lp-heading mt-2 text-[24px] leading-tight">{title}</h2>
              {description ? <p className="mt-1.5 max-w-3xl text-[14px] leading-[1.6] text-[#6b6b6b]">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6b6b6b] transition-colors hover:bg-[#f6f5f1] hover:text-[#111111]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5 sm:p-7">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
