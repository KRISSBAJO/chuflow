import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { UserCreateForm } from "@/components/user-create-form";
import type { BranchSummary, OversightRegionOption, DistrictOption } from "@/lib/types";

export default async function NewPage() {
 const user = await requireServerRole("/users");
 const t = await getTranslations("org.users");
 const [branches, regions, districts] = await Promise.all([serverGet<BranchSummary[]>("/branches"), serverGet<OversightRegionOption[]>("/oversight-regions"), serverGet<DistrictOption[]>("/districts")]);
 return <CreatePage title={t("pageTitle")} backHref="/users"><UserCreateForm branches={branches} currentUserRole={user.role} defaultBranchId={user.branchId} defaultOversightRegion={user.oversightRegion} defaultDistrict={user.district} oversightRegions={regions} districts={districts} /></CreatePage>;
}
