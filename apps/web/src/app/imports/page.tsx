import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/import-wizard";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { IMPORT_CONFIG, type ImportKind } from "@/lib/import-fields";
import type { ImportView, ImportHistory } from "@/lib/import-types";
import { getTranslations } from "next-intl/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; job?: string }>;
}) {
  const user = await requireServerRole("/imports");
  const params = await searchParams;
  const kind = Object.hasOwn(IMPORT_CONFIG, params.kind || "")
    ? (params.kind as ImportKind)
    : "members";
  const [options, history, initial, t] = await Promise.all([
    serverGet<{ branches: { _id: string; name: string }[] }>(
      "/imports/options",
    ),
    serverGet<ImportHistory[]>("/imports"),
    params.job
      ? serverGet<ImportView>(`/imports/${encodeURIComponent(params.job)}`)
      : Promise.resolve(undefined),
    getTranslations("imports"),
  ]);
  return (
    <Shell>
      <Link
        href={IMPORT_CONFIG[initial?.job.kind || kind].path}
        className="text-sm text-[#6b6b6b]"
      >
        ← {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <ImportWizard
        key={params.job || "new"}
        branches={options.branches}
        defaultBranchId={user.branchId}
        initialKind={kind}
        initial={initial}
        history={history}
      />
    </Shell>
  );
}
