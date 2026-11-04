import { CreatePage } from "@/components/create-page";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { ServiceUnitCreateForm } from "@/components/service-unit-create-form";
import type { BranchSummary, MemberListItem } from "@/lib/types";

export default async function NewPage() {
 const user = await requireServerRole("/service-units");
 const [branches, members] = await Promise.all([serverGet<BranchSummary[]>("/branches"), serverGet<MemberListItem[]>("/members")]);
 return <CreatePage title="Create service unit" backHref="/service-units"><ServiceUnitCreateForm branches={branches} members={members} currentUserRole={user.role} defaultBranchId={user.branchId} /></CreatePage>;
}
