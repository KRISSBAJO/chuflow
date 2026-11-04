import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { BranchCreateForm } from "@/components/branch-create-form";
import { canManageBranchStructure } from "@/lib/permissions";
import { redirect } from "next/navigation";
import type { OversightRegionOption, DistrictOption } from "@/lib/types";

export default async function NewPage() {
 const user = await requireServerRole("/branches");
 if (!canManageBranchStructure(user.role)) redirect("/unauthorized");
 const [regions, districts] = await Promise.all([serverGet<OversightRegionOption[]>("/oversight-regions"), serverGet<DistrictOption[]>("/districts")]);
 return <CreatePage title="Create branch" backHref="/branches"><BranchCreateForm currentUserRole={user.role} defaultOversightRegion={user.oversightRegion} defaultDistrict={user.district} oversightRegions={regions} districts={districts} /></CreatePage>;
}
