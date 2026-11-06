import { getTranslations } from "next-intl/server";
import { CreatePage } from "@/components/create-page";
import { PermissionEditor } from "@/components/permissions/permission-editor";
import { requireServerRole } from "@/lib/auth";
export default async function NewPermissionPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; permission?: string }>;
}) {
  await requireServerRole("/permissions");
  const t = await getTranslations("permissionManager");
  const params = await searchParams;
  return (
    <CreatePage title={t("add")} backHref="/permissions">
      <PermissionEditor
        key={params.userId || "search"}
        userId={params.userId}
        initialPermission={params.permission}
      />
    </CreatePage>
  );
}
