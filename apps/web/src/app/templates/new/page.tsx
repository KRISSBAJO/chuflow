import { CreatePage } from "@/components/create-page";
import { TemplateEditorCard } from "@/components/template-editor-card";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { getTranslations } from "next-intl/server";
import type { BranchSummary } from "@/lib/types";
export default async function NewPage() {
 const user = await requireServerRole("/templates");
 const t = await getTranslations("admin.templates");
 const branches = await serverGet<BranchSummary[]>("/branches");
 return <CreatePage title={t("create")} backHref="/templates">            <TemplateEditorCard
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
              defaultOversightRegion={user.oversightRegion}
              defaultDistrict={user.district}
            />
</CreatePage>;
}
