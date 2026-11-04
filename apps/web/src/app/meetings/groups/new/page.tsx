import { redirect } from "next/navigation";
import { CreatePage } from "@/components/create-page";
import { MeetingGroupForm } from "@/components/meetings/forms";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const options = await serverGet<MeetingOptions>("/meetings/options");
  if (!options.isAdmin) redirect("/meetings");
  return (
    <CreatePage title="Add meeting group" backHref="/meetings/groups">
      <MeetingGroupForm options={options} />
    </CreatePage>
  );
}
