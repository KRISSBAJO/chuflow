"use client";

import { useState, type ReactNode } from "react";
import { ModalShell } from "@/components/modal-shell";
import { Button, Field } from "@/components/ui/ui";
import { Notice } from "./ops-ui";
import { errorMessage } from "@/lib/ops/client";

/** A confirmation that requires a written reason, kept in the audit log by the API. */
export function ReasonDialog({
  open,
  onClose,
  eyebrow,
  title,
  description,
  confirmLabel,
  danger = false,
  optional = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  optional?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    if (!optional && reason.trim().length < 3) {
      setError("Write at least a few words so the audit log explains this change.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} eyebrow={eyebrow} title={title} description={description} maxWidthClass="max-w-lg">
      <div className="space-y-4">
        <Field label={optional ? "Reason (optional)" : "Reason"} required={!optional} hint="Recorded in the audit log with your operator account.">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="ui-input" maxLength={500} rows={3} />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => void confirm()} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

/** Shared footer for the console's editing forms. */
export function FormFooter({ busy, error, onCancel, submitLabel, extra }: { busy: boolean; error: string | null; onCancel?: () => void; submitLabel: string; extra?: ReactNode }) {
  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {extra}
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
