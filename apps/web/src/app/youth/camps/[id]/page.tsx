import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { YouthCampWorkspace, type CampOverview } from "@/components/youth/youth-camp";
import { requireServerRole } from "@/lib/auth";
import { serverGet, ServerApiError } from "@/lib/server-api";

export default async function CampPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ branch?: string; date?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const user = await requireServerRole(`/youth/camps/${id}`);
  const { branch, date } = await searchParams;
  const query = new URLSearchParams();
  if (branch && /^[a-f0-9]{24}$/i.test(branch)) query.set("branch", branch);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query.set("date", date);
  const [t, data] = await Promise.all([
    getTranslations("youth"),
    serverGet<CampOverview>(`/youth/camps/${id}?${query}`).catch(error => {
      if (error instanceof ServerApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);
  return <Shell><main className="mx-auto max-w-5xl space-y-6">
    <Link href="/youth?view=camps" className="inline-flex min-h-11 items-center text-sm font-semibold underline">{t("camps")}</Link>
    <PageHeader eyebrow={data.group.program} title={data.group.name} description={data.group.venue} />
    <YouthCampWorkspace data={data} workspace={user.workspace?.id} />
  </main></Shell>;
}
