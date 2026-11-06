import { CreatePage } from "@/components/create-page";
import { getTranslations } from "next-intl/server";
import { OutreachLinkForm } from "@/components/evangelism/link-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function NewOutreachLinkPage() {
  const user = await requireServerRole("/evangelism");
  const t = await getTranslations("people.evangelism.links");
  const branches = await serverGet<BranchSummary[]>("/evangelism/branches");
  return (
    <CreatePage title={t("newTitle")} backHref="/evangelism/links">
      <OutreachLinkForm branches={branches} defaultBranchId={user.branchId} />
    </CreatePage>
  );
}
