import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { ServiceUnitCreateForm } from "@/components/service-unit-create-form";
import type { BranchSummary, MemberListItem } from "@/lib/types";

export default async function NewPage() {
 const user = await requireServerRole("/service-units/new");
 const t = await getTranslations("org.serviceUnits");
 const [branches, members] = await Promise.all([serverGet<BranchSummary[]>("/branches"), serverGet<MemberListItem[]>("/members")]);
 return <CreatePage title={t("createUnit")} backHref="/service-units"><ServiceUnitCreateForm branches={branches} members={members} currentUserRole={user.role} defaultBranchId={user.branchId} /></CreatePage>;
}
