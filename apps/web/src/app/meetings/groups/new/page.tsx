import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { MeetingGroupForm } from "@/components/meetings/forms";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const [options, t] = await Promise.all([
    serverGet<MeetingOptions>("/meetings/options"),
    getTranslations("services.meetings.pages"),
  ]);
  if (!options.isAdmin) redirect("/meetings");
  return (
    <CreatePage title={t("addGroup")} backHref="/meetings/groups">
      <MeetingGroupForm options={options} />
    </CreatePage>
  );
}
