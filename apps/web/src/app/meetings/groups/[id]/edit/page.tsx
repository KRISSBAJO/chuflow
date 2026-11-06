import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { MeetingGroupForm } from "@/components/meetings/forms";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/meetings");
  const { id } = await params;
  const [options, t] = await Promise.all([
    serverGet<MeetingOptions>("/meetings/options"),
    getTranslations("services.meetings.pages"),
  ]);
  if (!options.isAdmin) redirect("/meetings");
  const group = options.groups.find((g) => g._id === id);
  if (!group) notFound();
  return (
    <CreatePage
      title={t("editGroup")}
      backHref="/meetings/groups"
    >
      <MeetingGroupForm options={options} group={group} />
    </CreatePage>
  );
}
