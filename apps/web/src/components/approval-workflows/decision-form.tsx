"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.decisionForm");
  const tr = useTranslations("admin.approvalRequests");
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
      setError(e instanceof Error ? e.message : t("saveError"));
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
          ? t("recordDecision")
          : isAuthor
            ? t("manageRequest")
            : t("returnRerouting")}
      </h2>
      <form key={r.revision} onSubmit={submit} className="mt-4 space-y-4">
        <Field label={t("decision")}>
          <select
            className="ui-input"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {r.canReview && (
              <>
                <option value="advance">
                  {final ? t("approveRequest") : t("recommendForward")}
                </option>
                <option value="reject">{t("rejectRequest")}</option>
                <option value="return">{t("returnCorrections")}</option>
                {final && r.finalLevel !== "national" && (
                  <option value="escalate">
                    {t("escalate")}
                  </option>
                )}
              </>
            )}
            {isAuthor && <option value="withdraw">{t("withdraw")}</option>}
            {r.canManage && !isAuthor && !r.canReview && (
              <option value="return">{t("returnToRequester")}</option>
            )}
          </select>
        </Field>
        {action === "escalate" && (
          <Field label={t("newFinalLevel")} required>
            <select className="ui-input" name="targetLevel" required>
              {approvalLevels
                .filter(
                  (l) =>
                    approvalLevels.indexOf(l) >
                    approvalLevels.indexOf(r.finalLevel),
                )
                .map((l) => (
                  <option key={l} value={l}>
                    {tr(`level.${l}`)}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label={t("reason")} required>
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
          {busy ? t("saving") : t("save")}
        </Button>
      </form>
    </Card>
  );
}
