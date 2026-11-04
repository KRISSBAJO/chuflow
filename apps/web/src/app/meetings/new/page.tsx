import { CreatePage } from "@/components/create-page";
import { MeetingForm } from "@/components/meetings/forms";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const options = await serverGet<MeetingOptions>("/meetings/options");
  return (
    <CreatePage title="Schedule meeting" backHref="/meetings">
      <MeetingForm options={options} />
    </CreatePage>
  );
}
