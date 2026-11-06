import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { MeetingForm } from "@/components/meetings/forms";
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
  const [meeting, options, t] = await Promise.all([
    serverGet<Meeting>(`/meetings/${id}`),
    serverGet<MeetingOptions>("/meetings/options?mode=form"),
    getTranslations("services.meetings.pages"),
  ]);
  if (!meeting.canManage) redirect(`/meetings/${id}`);
  return (
    <CreatePage title={t("editMeeting")} backHref={`/meetings/${id}`}>
      <MeetingForm options={options} meeting={meeting} />
    </CreatePage>
  );
}
