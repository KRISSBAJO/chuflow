import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { MeetingForm } from "@/components/meetings/forms";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const [options, t] = await Promise.all([
    serverGet<MeetingOptions>("/meetings/options?mode=form"),
    getTranslations("services.meetings.pages"),
  ]);
  return (
    <CreatePage title={t("scheduleMeeting")} backHref="/meetings">
      <MeetingForm options={options} />
    </CreatePage>
  );
}
