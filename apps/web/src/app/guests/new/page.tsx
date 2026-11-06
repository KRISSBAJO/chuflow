import { CreatePage } from "@/components/create-page";
import { getTranslations } from "next-intl/server";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { GuestCreateForm } from "@/components/guest-create-form";
import type { BranchSummary, UserSummary, ServiceTypeSummary } from "@/lib/types";

export default async function NewPage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
 const user = await requireServerRole("/guests/new");
 const t = await getTranslations("people.guests.create");
 const { branchId } = await searchParams;
 const [branches, users, serviceTypes] = await Promise.all([serverGet<BranchSummary[]>("/branches/options"), serverGet<UserSummary[]>("/users/assignment-options"), serverGet<ServiceTypeSummary[]>("/service-types")]);
 return <CreatePage title={t("pageTitle")} backHref="/guests"><GuestCreateForm branches={branches} users={users} serviceTypes={serviceTypes} defaultBranchId={branches.some((branch) => branch._id === branchId) ? branchId : user.branchId} /></CreatePage>;
}
