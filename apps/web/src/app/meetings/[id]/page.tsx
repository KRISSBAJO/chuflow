import Link from "next/link";
import { Shell } from "@/components/shell";
import { MeetingDetails } from "@/components/meetings/details";
import { buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { Meeting, MeetingOptions } from "@/lib/meetings";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/meetings");
  const { id } = await params;
  const [meeting, options] = await Promise.all([
    serverGet<Meeting>(`/meetings/${id}`),
    serverGet<MeetingOptions>("/meetings/options?mode=form"),
  ]);
  return (
    <Shell>
      <div>
        <Link className={buttonClass("ghost", "sm")} href="/meetings">
          ← Back to meetings
        </Link>
      </div>
      <MeetingDetails initial={meeting} options={options} />
    </Shell>
  );
}
