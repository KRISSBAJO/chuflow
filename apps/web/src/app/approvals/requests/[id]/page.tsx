import Link from "next/link";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { Card, buttonClass } from "@/components/ui/ui";
import { ApprovalDecisionForm } from "@/components/approval-workflows/decision-form";
import type { ApprovalRequest } from "@/lib/approval-workflows";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireServerRole("/approvals/requests");
  const { id } = await params;
  const q = await searchParams;
  const r = await serverGet<ApprovalRequest>(
    `/approval-workflows/requests/${encodeURIComponent(id)}`,
  );
  const isAuthor = (user._id || user.id) === r.requesterId;
  return (
    <Shell>
      <Link href="/approvals/requests" className="text-sm hover:underline">
        ← Back to requests
      </Link>
      {q.submitted && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-3 text-sm text-green-800"
        >
          Request submitted. Your route and current reviewer are shown below.
        </p>
      )}
      <Card className="border-t-4 border-t-orange-400 p-6">
        <p className="text-xs uppercase tracking-wide text-[#b95c18]">
          {r.category} · {r.status}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{r.title}</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          {r.branchName} · {r.policyName} · Ends at {r.finalLevel}
        </p>
        {r.amount !== undefined && (
          <p className="mt-3 font-semibold">
            {r.currency} {r.amount.toLocaleString()}
          </p>
        )}
        {r.status === "returned" && isAuthor && (
          <Link
            href={`/approvals/requests/${id}/edit`}
            className={`${buttonClass("primary")} mt-4`}
          >
            Edit and resubmit
          </Link>
        )}
      </Card>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Request details</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
              {r.details}
            </p>
            {r.documentLinks.length > 0 && (
              <ul className="mt-4 space-y-2">
                {r.documentLinks.map((url, i) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm underline"
                    >
                      Supporting document {i + 1} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <ApprovalDecisionForm
            key={`${r._id}-${r.revision}`}
            request={r}
            isAuthor={isAuthor}
          />
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Decision history</h2>
            <ol className="mt-4 divide-y divide-black/5">
              {r.history.map((h, i) => (
                <li key={i} className="py-3 text-sm">
                  <p className="font-medium">
                    {h.action}
                    {h.level ? ` · ${h.level}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{h.note}</p>
                  {h.submission && (
                    <details className="mt-3 rounded-lg border border-black/10 p-3">
                      <summary className="cursor-pointer">
                        View submitted version
                      </summary>
                      <p className="mt-3 font-medium">{h.submission.title}</p>
                      <p className="mt-2 whitespace-pre-wrap">
                        {h.submission.details}
                      </p>
                      {h.submission.amount !== undefined && (
                        <p className="mt-2">
                          {h.submission.currency} {h.submission.amount}
                        </p>
                      )}
                      {h.submission.documentLinks.map((url, index) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block underline"
                        >
                          Document {index + 1}
                        </a>
                      ))}
                    </details>
                  )}
                  <p className="mt-2 text-xs text-[#8a8780]">
                    {h.actorName} ·{" "}
                    {new Date(h.at).toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Approval route</h2>
          <ol className="mt-4 space-y-4">
            {r.stages.map((s, i) => (
              <li
                key={s.level}
                className={`rounded-xl border p-3 text-sm ${r.status === "pending" && i === r.currentStage ? "border-orange-300 bg-orange-50" : "border-black/5"}`}
              >
                <p className="font-semibold">
                  {i + 1}. {s.label}
                </p>
                <p className="mt-1 text-[#6b6b6b]">
                  {s.reviewerNames.join(", ")}
                </p>
                <p className="mt-2 text-xs">
                  {i === r.stages.length - 1
                    ? "Final approval"
                    : "Recommendation"}
                  {r.status === "pending" && i === r.currentStage
                    ? " · Awaiting review"
                    : ""}
                </p>
              </li>
            ))}
          </ol>
          {r.status === "pending" && (
            <p className="mt-4 text-sm text-[#6b6b6b]">
              Review due{" "}
              {new Date(r.dueAt).toLocaleDateString("en-US", {
                timeZone: "UTC",
              })}
              . Overdue reviews receive reminders; they are never approved
              automatically.
            </p>
          )}
        </Card>
      </div>
    </Shell>
  );
}
