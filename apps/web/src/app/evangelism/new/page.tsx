import { CreatePage } from "@/components/create-page";
import { getTranslations } from "next-intl/server";
import { OutreachContactForm } from "@/components/evangelism/contact-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary } from "@/lib/types";

export default async function NewOutreachContactPage() {
  const user = await requireServerRole("/evangelism");
  const t = await getTranslations("people.evangelism.new");
  const branches = await serverGet<BranchSummary[]>("/evangelism/branches");
  return (
    <CreatePage title={t("title")} backHref="/evangelism">
      <OutreachContactForm
        branches={branches}
        defaultBranchId={user.branchId}
      />
    </CreatePage>
  );
}
