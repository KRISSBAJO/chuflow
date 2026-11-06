import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { UserCreateForm } from "@/components/user-create-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { getManageableUserRoleOptions } from "@/lib/permissions";
import { redirect } from "next/navigation";
import type { BranchSummary, OversightRegionOption, DistrictOption } from "@/lib/types";
export default async function NewPage() {
 const user = await requireServerRole("/branches");
 const branchScopedCreateRoles = ["branch_admin", "resident_pastor", "associate_pastor", "follow_up", "usher"];
 if (!getManageableUserRoleOptions(user.role).some(role => branchScopedCreateRoles.includes(role))) redirect("/unauthorized");
 const [branches, oversightRegions, districts] = await Promise.all([serverGet<BranchSummary[]>("/branches"), serverGet<OversightRegionOption[]>("/oversight-regions"), serverGet<DistrictOption[]>("/districts")]);
 const defaultStaffBranchId = user.branchId;
 const t = await getTranslations("org.branches");
 return <CreatePage title={t("staffPageTitle")} backHref="/branches">              <UserCreateForm
                branches={branches}
                currentUserRole={user.role}
                defaultBranchId={defaultStaffBranchId}
                defaultOversightRegion={user.oversightRegion}
                defaultDistrict={user.district}
                oversightRegions={oversightRegions}
                districts={districts}
                allowedRoles={branchScopedCreateRoles}
                title={t("staffTitle")}
                description={t("staffDescription")}
                submitLabel={t("staffSubmit")}
              />
</CreatePage>;
}
