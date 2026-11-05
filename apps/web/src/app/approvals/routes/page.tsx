import Link from "next/link";
import { redirect } from "next/navigation";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import type { ApprovalOptions } from "@/lib/approval-workflows";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireServerRole("/approvals/routes");
  const data = await serverGet<ApprovalOptions>("/approval-workflows/options");
  if (!data.canManage) redirect("/unauthorized");
  const q = await searchParams;
  return (
    <Shell>
      <Link href="/approvals/requests" className="text-sm hover:underline">
        ← Back to requests
      </Link>
      <PageHeader
        eyebrow="Approval settings"
        title="Approval routes"
        description="Set where each type of request ends. Routes apply to churches in the selected national area."
        action={
          <Link href="/approvals/routes/new" className={buttonClass("primary")}>
            + New route
          </Link>
        }
      />
      {q.saved && (
        <p role="status" className="text-sm text-green-800">
          Approval route saved.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data.policies.map((p) => (
          <Link key={p._id} href={`/approvals/routes/${p._id}`}>
            <Card className="h-full p-5 transition hover:ring-1 hover:ring-orange-300">
              <p className="text-xs uppercase text-[#b95c18]">
                {p.category} · {p.isActive ? "Active" : "Inactive"}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{p.name} →</h2>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                {p.oversightRegion} · Ends at {p.finalLevel} · {p.reviewDays}{" "}
                days per review
              </p>
              {p.thresholdAmount !== undefined && (
                <p className="mt-2 text-sm">
                  Above {p.currency} {p.thresholdAmount}:{" "}
                  {p.aboveThresholdLevel}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
      {!data.policies.length && (
        <Card className="p-8 text-sm">
          No routes configured. Create a route with a final level before staff
          submit general requests.
        </Card>
      )}
    </Shell>
  );
}
