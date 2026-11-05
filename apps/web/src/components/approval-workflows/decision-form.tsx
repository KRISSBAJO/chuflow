"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { Button, Card, Field } from "@/components/ui/ui";
import { approvalLevels, type ApprovalRequest } from "@/lib/approval-workflows";
export function ApprovalDecisionForm({
  request: r,
  isAuthor,
}: {
  request: ApprovalRequest;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [action, setAction] = useState(
    r.canReview ? "advance" : isAuthor ? "withdraw" : "return",
  );
  const final = r.currentStage === r.stages.length - 1;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await apiPost(`/approval-workflows/requests/${r._id}/decision`, {
        action,
        note: f.get("note"),
        expectedRevision: r.revision,
        ...(action === "escalate" ? { targetLevel: f.get("targetLevel") } : {}),
      });
      router.refresh();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save decision.");
      setBusy(false);
    }
  }
  if (
    !(
      r.canReview ||
      (isAuthor && ["pending", "returned"].includes(r.status)) ||
      (r.canManage && !isAuthor && r.status === "pending")
    )
  )
    return null;
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">
        {r.canReview
          ? "Record your decision"
          : isAuthor
            ? "Manage request"
            : "Return for rerouting"}
      </h2>
      <form key={r.revision} onSubmit={submit} className="mt-4 space-y-4">
        <Field label="Decision">
          <select
            className="ui-input"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {r.canReview && (
              <>
                <option value="advance">
                  {final ? "Approve request" : "Recommend and forward"}
                </option>
                <option value="reject">Reject request</option>
                <option value="return">Return for corrections</option>
                {final && r.finalLevel !== "national" && (
                  <option value="escalate">
                    Escalate to a higher final level
                  </option>
                )}
              </>
            )}
            {isAuthor && <option value="withdraw">Withdraw request</option>}
            {r.canManage && !isAuthor && !r.canReview && (
              <option value="return">Return to requester for rerouting</option>
            )}
          </select>
        </Field>
        {action === "escalate" && (
          <Field label="New final approval level" required>
            <select className="ui-input" name="targetLevel" required>
              {approvalLevels
                .filter(
                  (l) =>
                    approvalLevels.indexOf(l) >
                    approvalLevels.indexOf(r.finalLevel),
                )
                .map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Reason or recommendation" required>
          <textarea
            name="note"
            className="ui-input min-h-28"
            minLength={3}
            maxLength={5000}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save decision"}
        </Button>
      </form>
    </Card>
  );
}
