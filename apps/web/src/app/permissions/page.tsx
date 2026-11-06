import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { PermissionLedger } from "@/components/permissions/permission-ledger";
import { requireServerRole } from "@/lib/auth";
export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  await requireServerRole("/permissions");
  const t = await getTranslations("permissionManager");
  const params = await searchParams;
  return (
    <Shell>
      <PageHeader
        eyebrow={t("permissionCard")}
        title={t("title")}
        description={t("description")}
      />
      <PermissionLedger
        key={params.userId || "all"}
        recipientId={params.userId}
      />
    </Shell>
  );
}
