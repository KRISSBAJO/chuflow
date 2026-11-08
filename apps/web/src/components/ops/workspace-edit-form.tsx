"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormFooter } from "./ops-dialogs";
import { KeyValue } from "./ops-ui";
import { Button, Field } from "@/components/ui/ui";
import { errorMessage, opsRequest } from "@/lib/ops/client";
import type { WorkspaceView } from "@/lib/ops/types";

export function WorkspaceEditForm({ workspace, editable }: { workspace: WorkspaceView; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    try {
      await opsRequest("PATCH", `/workspaces/${workspace.id}`, {
        name: value("name"),
        ownerEmail: value("ownerEmail"),
        region: value("region"),
        notes: value("notes"),
      });
      toast.success("Workspace details saved.");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <KeyValue
          items={[
            { label: "Handle", value: workspace.id },
            { label: "Database", value: workspace.databaseName ?? (workspace.primary ? "Primary database (from environment)" : "—") },
            { label: "First admin", value: workspace.adminEmail ?? "—" },
            { label: "Owner / billing contact", value: workspace.ownerEmail ?? "—" },
            { label: "Region", value: workspace.region ?? "—" },
            { label: "Created", value: workspace.createdAt ? new Date(workspace.createdAt).toLocaleString() : "—" },
          ]}
        />
        {workspace.notes ? <p className="whitespace-pre-wrap rounded-2xl bg-[#f6f5f1] px-4 py-3 text-[14px] text-[#3d3b37]">{workspace.notes}</p> : null}
        {editable && !workspace.primary ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Church name" required>
          <input name="name" className="ui-input" defaultValue={workspace.name} required minLength={2} maxLength={120} />
        </Field>
        <Field label="Owner / billing contact">
          <input name="ownerEmail" type="email" className="ui-input" defaultValue={workspace.ownerEmail ?? ""} maxLength={254} />
        </Field>
        <Field label="Region">
          <input name="region" className="ui-input" defaultValue={workspace.region ?? ""} maxLength={80} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" className="ui-input" defaultValue={workspace.notes ?? ""} maxLength={2000} rows={3} />
      </Field>
      <FormFooter busy={busy} error={error} onCancel={() => setEditing(false)} submitLabel="Save details" />
    </form>
  );
}
