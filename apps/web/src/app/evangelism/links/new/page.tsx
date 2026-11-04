import { CreatePage } from "@/components/create-page";
import { OutreachLinkForm } from "@/components/evangelism/link-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function NewOutreachLinkPage() {
  const user = await requireServerRole("/evangelism");
  const branches = await serverGet<BranchSummary[]>("/evangelism/branches");
  return (
    <CreatePage title="Create evangelism link" backHref="/evangelism/links">
      <OutreachLinkForm branches={branches} defaultBranchId={user.branchId} />
    </CreatePage>
  );
}
