"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPatch, apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import { approvalLevels, type ApprovalPolicy } from "@/lib/approval-workflows";
export function ApprovalPolicyForm({
  policy,
  regions,
}: {
  policy?: ApprovalPolicy;
  regions: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const threshold = String(f.get("thresholdAmount") || "");
    const body = {
      oversightRegion: f.get("oversightRegion"),
      name: f.get("name"),
      category: f.get("category"),
      finalLevel: f.get("finalLevel"),
      currency: String(f.get("currency")).toUpperCase(),
      reviewDays: Number(f.get("reviewDays")),
      isActive: f.get("isActive") === "on",
      ...(threshold
        ? {
            thresholdAmount: Number(threshold),
            aboveThresholdLevel: f.get("aboveThresholdLevel"),
          }
        : {}),
      ...(policy ? { expectedRevision: policy.revision } : {}),
    };
    try {
      if (policy)
        await apiPatch(`/approval-workflows/policies/${policy._id}`, body);
      else await apiPost("/approval-workflows/policies", body);
      router.push("/approvals/routes?saved=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save route.");
      setBusy(false);
    }
  }
  return (
    <Card className="max-w-3xl p-6">
      <form onSubmit={submit} className="space-y-5">
        <Field label="National area" required>
          <input
            name="oversightRegion"
            className="ui-input"
            list="approval-regions"
            defaultValue={policy?.oversightRegion || regions[0] || ""}
            readOnly={!!policy}
            required
          />
          <datalist id="approval-regions">
            {regions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Route name" required>
          <input
            name="name"
            className="ui-input"
            defaultValue={policy?.name}
            placeholder="For example, Local welfare request"
            minLength={2}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Request category" required>
          <input
            name="category"
            className="ui-input"
            defaultValue={policy?.category}
            placeholder="Staff matters, welfare, events"
            minLength={2}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Final approval level" required>
          <select
            name="finalLevel"
            className="ui-input"
            defaultValue={policy?.finalLevel || ""}
            required
          >
            <option value="" disabled>
              Choose where approval ends
            </option>
            {approvalLevels.map((l) => (
              <option key={l} value={l}>
                {l === "zone"
                  ? "Zonal pastor"
                  : l === "church"
                    ? "Local church"
                    : `${l[0].toUpperCase() + l.slice(1)} pastor`}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-[#6b6b6b]">
          Church → Area → Zone → District → National, stopping at the chosen
          final level. Unassigned intermediate levels are skipped; a missing
          final level or reviewer blocks submission. Requesters cannot approve
          their own requests.
        </p>
        <details className="rounded-xl border border-black/10 p-4">
          <summary className="cursor-pointer font-medium">
            Amount-based escalation (optional)
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Above this amount">
              <input
                name="thresholdAmount"
                type="number"
                min="0"
                step="0.01"
                max="1000000000000"
                className="ui-input"
                defaultValue={policy?.thresholdAmount}
              />
            </Field>
            <Field label="Higher final level">
              <select
                name="aboveThresholdLevel"
                className="ui-input"
                defaultValue={policy?.aboveThresholdLevel || ""}
              >
                <option value="">Choose a higher level</option>
                {approvalLevels.slice(1).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" required>
            <input
              name="currency"
              className="ui-input uppercase"
              defaultValue={policy?.currency || "USD"}
              pattern="[A-Za-z]{3}"
              maxLength={3}
              required
            />
          </Field>
          <Field label="Days allowed per review" required>
            <input
              name="reviewDays"
              type="number"
              min={1}
              max={90}
              className="ui-input"
              defaultValue={policy?.reviewDays || 3}
              required
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={policy?.isActive ?? true}
          />
          Active route
        </label>
        <p className="text-sm text-[#6b6b6b]">
          Changes apply to new and resubmitted requests. Existing requests
          retain their recorded route.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save route"}
        </Button>
      </form>
    </Card>
  );
}
