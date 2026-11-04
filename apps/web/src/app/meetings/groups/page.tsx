import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const options = await serverGet<MeetingOptions>("/meetings/options");
  if (!options.isAdmin) redirect("/meetings");
  return (
    <Shell>
      <Link href="/meetings" className={buttonClass("secondary", "sm")}>
        ← Back to meetings
      </Link>
      <PageHeader
        eyebrow="Admin"
        title="Meeting group requirements"
        description="Enable groups, assign minute submitters and reviewers, and set submission deadlines."
        action={
          <Link href="/meetings/groups/new" className={buttonClass()}>
            + Add meeting group
          </Link>
        }
      />
      {options.groups.length === 0 && (
        <Card className="p-6">
          No meeting groups yet. Add a group and optionally connect it to an
          existing service group.
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {options.groups.map((g) => (
          <Card className="p-6 space-y-3" key={g._id}>
            <p className="text-sm text-[#6b6b6b]">
              {typeof g.branchId === "object" ? g.branchId.name : ""} ·{" "}
              {g.enabled ? "Enabled" : "Disabled"}
            </p>
            <h2 className="text-xl font-semibold">{g.name}</h2>
            <p>
              {g.minutesRequired
                ? `Minutes required within ${g.minutesDueHours} hours`
                : "Minutes optional"}
            </p>
            <p className="text-sm">
              {g.submitterUserIds.length} submitters ·{" "}
              {g.reviewerUserIds.length} reviewers
            </p>
            <Link
              className={buttonClass("secondary")}
              href={`/meetings/groups/${g._id}/edit`}
            >
              Edit group requirements
            </Link>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
