import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { YouthGroupWorkspace } from "@/components/youth/youth-group";
import { requireServerRole } from "@/lib/auth";
import { serverGet, ServerApiError } from "@/lib/server-api";
import type { YouthDetail } from "@/lib/youth";

export default async function YouthGroupPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const user = await requireServerRole(`/youth/${id}`);
  const { date } = await searchParams;
  const query = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? "?date=" + date : "";
  const [t, data] = await Promise.all([
    getTranslations("youth"),
    serverGet<YouthDetail>(`/youth/groups/${id}${query}`).catch(error => {
      if (error instanceof ServerApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);
  return <Shell><main className="mx-auto max-w-4xl space-y-6">
    <Link href="/youth" className="inline-flex min-h-11 items-center text-sm font-semibold underline">{t("back")}</Link>
    <PageHeader eyebrow={data.group.program} title={data.group.name} description={t("ages", { from: data.group.minAge, to: data.group.maxAge })} />
    <YouthGroupWorkspace data={data} workspace={user.workspace?.id} />
  </main></Shell>;
}
