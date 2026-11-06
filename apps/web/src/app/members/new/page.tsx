import { getTranslations } from "next-intl/server";
import { ChildMemberEntry } from "@/components/children/member-entry";
import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { MemberCreateForm } from "@/components/member-create-form";
import type {
  BranchSummary,
  GuestListResponse,
  ServiceUnitSummary,
} from "@/lib/types";

export default async function NewPage() {
  const user = await requireServerRole("/members/new");
  const t = await getTranslations("org.memberForm");
  const [branches, guests, units] = await Promise.all([
    serverGet<BranchSummary[]>("/branches"),
    serverGet<GuestListResponse>("/guests?limit=500").catch(() => ({items: []})),
    serverGet<ServiceUnitSummary[]>("/service-units").catch(() => []),
  ]);
  return (
    <CreatePage title={t("pageTitle")} backHref="/members">
      <ChildMemberEntry role={user.role} />
      <MemberCreateForm
        branches={branches}
        guests={guests.items}
        serviceUnits={units}
        defaultBranchId={user.branchId}
      />
    </CreatePage>
  );
}
