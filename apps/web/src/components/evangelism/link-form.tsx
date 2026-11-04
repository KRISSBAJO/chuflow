"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiPatch } from "@/lib/api";
import type { BranchSummary } from "@/lib/types";
import { Button, Card, Field } from "@/components/ui/ui";

export function OutreachLinkForm({
  branches,
  defaultBranchId,
}: {
  branches: BranchSummary[];
  defaultBranchId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiPost("/evangelism/links", {
        branchId: data.get("branchId"),
        name: data.get("name"),
        kind: data.get("kind"),
      });
      router.push("/evangelism/links");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Branch" required>
          <select
            name="branchId"
            className="ui-input"
            required
            defaultValue={defaultBranchId || branches[0]?._id}
          >
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Link name"
          required
          hint="Use a name your team can recognize, such as Saturday outreach or My invitation link."
        >
          <input
            name="name"
            className="ui-input"
            required
            minLength={2}
            maxLength={100}
          />
        </Field>
        <Field label="Link type" required>
          <select name="kind" className="ui-input">
            <option value="personal">
              My personal link — assign new contacts to me
            </option>
            <option value="branch">
              Branch link — add contacts to the shared unassigned queue
            </option>
          </select>
        </Field>
        <p className="text-sm text-[#6b6b6b]">
          Anyone with the link can submit their details without signing in. They
          cannot see your contact list or private follow-up notes.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !branches.length}>
          {busy ? "Creating…" : "Create shareable link"}
        </Button>
      </form>
    </Card>
  );
}

export function OutreachLinkToggle({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/evangelism/links/${id}`, { isActive: !active });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" size="sm" disabled={busy} onClick={toggle}>
        {busy ? "Saving…" : active ? "Pause link" : "Reactivate link"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
