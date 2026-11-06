import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { CareActivityForm } from "@/components/care/care-activity-form";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { CareRecord } from "@/lib/care";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireServerRole("/care");
  const { id } = await params;
  const [record, t, tw] = await Promise.all([
    serverGet<CareRecord>(`/care/cases/${id}`),
    getTranslations("people.care.detail"),
    getTranslations("workspace"),
  ]);
  if (!record.canManage) redirect(`/care/${id}`);
  return (
    <Shell>
      <Link
        href={`/care/${id}?tab=timeline`}
        className="text-sm text-[#6b6b6b]"
      >
        ← {tw("backTimeline")}
      </Link>
      <PageHeader
        eyebrow={tw("activity")}
        title={`${record.firstName} ${record.lastName}`}
        description={t("staffActivityNote")}
      />
      <div className="mx-auto w-full max-w-4xl">
        <CareActivityForm initial={record} />
      </div>
    </Shell>
  );
}
