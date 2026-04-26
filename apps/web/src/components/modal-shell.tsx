"use client";

import { ReactNode, useEffect } from "react";

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
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-4 py-6">
      <div className="flex min-h-full items-start justify-center">
        <div className={`relative w-full ${maxWidthClass} rounded-[32px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
          >
            Close
          </button>
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
