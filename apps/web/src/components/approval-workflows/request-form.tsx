"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import type {
  ApprovalOptions,
  ApprovalRequest,
  ApprovalStage,
} from "@/lib/approval-workflows";
export function ApprovalRequestForm({
  options,
  request,
  homeBranchId,
}: {
  options: ApprovalOptions;
  request?: ApprovalRequest;
  homeBranchId?: string;
}) {
  const router = useRouter();
  const [branchId, setBranch] = useState(
    request?.branchId || homeBranchId || options.branches[0]?._id || "",
  );
  const [policyId, setPolicy] = useState(request?.policyId || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<ApprovalStage[] | null>(null);
  const region = options.branches.find(
    (b) => b._id === branchId,
  )?.oversightRegion;
  const policies = options.policies.filter(
    (p) => p.isActive && p.oversightRegion === region,
  );
  const policy = policies.find((p) => p._id === policyId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const amount = String(f.get("amount") || "");
    const payload = {
      branchId,
      policyId,
      title: f.get("title"),
      details: f.get("details"),
      documentLinks: String(f.get("documentLinks") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      ...(amount ? { amount: Number(amount) } : {}),
      ...(request ? { expectedRevision: request.revision } : {}),
    };
    try {
      const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
        "value",
      );
      if (intent === "preview") {
        const result = await apiPost<{ stages: ApprovalStage[] }>(
          "/approval-workflows/preview",
          payload,
        );
        setPreview(result.stages);
        setBusy(false);
      } else {
        const result = await apiPost<{ _id: string }>(
          request
            ? `/approval-workflows/requests/${request._id}/resubmit`
            : "/approval-workflows/requests",
          payload,
        );
        router.push(`/approvals/requests/${result._id}?submitted=1`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit.");
      setBusy(false);
    }
  }
  return (
    <Card className="max-w-3xl p-6">
      <form
        onSubmit={submit}
        onChange={() => setPreview(null)}
        className="space-y-5"
      >
        <Field label="Church" required>
          <select
            className="ui-input"
            value={branchId}
            disabled={!!request}
            onChange={(e) => {
              setBranch(e.target.value);
              setPolicy("");
            }}
            required
          >
            {options.branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Approval route" required>
          <select
            className="ui-input"
            value={policyId}
            onChange={(e) => setPolicy(e.target.value)}
            required
          >
            <option value="">Choose a route</option>
            {policies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} · Ends at {p.finalLevel}
              </option>
            ))}
          </select>
        </Field>
        {!policies.length && (
          <p role="status" className="text-sm text-amber-800">
            No active routes for this church. Ask the national or overall
            administrator to configure a route.
          </p>
        )}
        {policy && (
          <p className="rounded-xl bg-orange-50 p-3 text-sm">
            {policy.category} · Final approval: {policy.finalLevel}
            {policy.thresholdAmount !== undefined
              ? `; amounts above ${policy.currency} ${policy.thresholdAmount} go to ${policy.aboveThresholdLevel}`
              : ""}
            . Review target: {policy.reviewDays} days per stage.
          </p>
        )}
        <Field label="Request title" required>
          <input
            name="title"
            className="ui-input"
            minLength={3}
            maxLength={160}
            defaultValue={request?.title}
            required
          />
        </Field>
        <Field label="Details and recommendation" required>
          <textarea
            name="details"
            className="ui-input min-h-40"
            minLength={10}
            maxLength={20000}
            defaultValue={request?.details}
            required
          />
        </Field>
        <Field
          label={`Amount (${policy?.currency || "route currency"})`}
          required={policy?.thresholdAmount !== undefined}
        >
          <input
            name="amount"
            className="ui-input"
            type="number"
            min="0"
            step="0.01"
            max="1000000000000"
            defaultValue={request?.amount}
            required={policy?.thresholdAmount !== undefined}
          />
        </Field>
        <Field
          label="Supporting document links"
          hint="One HTTPS link per line, up to 10. Make sure assigned reviewers can open the documents."
        >
          <textarea
            name="documentLinks"
            className="ui-input min-h-24"
            defaultValue={request?.documentLinks?.join("\n")}
          />
        </Field>
        {preview && (
          <div className="rounded-xl border border-orange-200 p-4">
            <h2 className="font-semibold">Your approval route</h2>
            <ol className="mt-3 space-y-3">
              {preview.map((s, i) => (
                <li key={s.level} className="text-sm">
                  <strong>
                    {i + 1}. {s.label}
                  </strong>
                  <p className="text-[#6b6b6b]">
                    {s.reviewerNames.join(", ")} ·{" "}
                    {i === preview.length - 1
                      ? "Final approval"
                      : "Review and recommendation"}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            type="submit"
            value="preview"
            disabled={busy || !policy}
          >
            Preview route
          </Button>
          <Button type="submit" value="submit" disabled={busy || !policy}>
            {busy
              ? "Working…"
              : request
                ? "Resubmit request"
                : "Submit request"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
