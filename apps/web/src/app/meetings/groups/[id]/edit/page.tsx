import { notFound, redirect } from "next/navigation";
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
  const options = await serverGet<MeetingOptions>("/meetings/options");
  if (!options.isAdmin) redirect("/meetings");
  const group = options.groups.find((g) => g._id === id);
  if (!group) notFound();
  return (
    <CreatePage
      title="Edit meeting group requirements"
      backHref="/meetings/groups"
    >
      <MeetingGroupForm options={options} group={group} />
    </CreatePage>
  );
}
