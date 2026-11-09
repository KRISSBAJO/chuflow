import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { YouthDevelopmentWorkspace, type YouthDevelopmentOverview } from "@/components/youth/youth-development";
import { requireServerRole } from "@/lib/auth";
import { serverGet, ServerApiError } from "@/lib/server-api";

export default async function DevelopmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  await requireServerRole(`/youth/${id}/development`);
  const [t, data] = await Promise.all([
    getTranslations("youth"),
    serverGet<YouthDevelopmentOverview>(`/youth/groups/${id}/development`).catch(error => {
      if (error instanceof ServerApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);
  return <Shell><main className="mx-auto max-w-4xl space-y-6">
    <Link href={`/youth/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline">{data.groupName}</Link>
    <PageHeader eyebrow={data.groupName} title={t("development")} description={t("developmentHint")} />
    <YouthDevelopmentWorkspace groupId={id} data={data} />
  </main></Shell>;
}
