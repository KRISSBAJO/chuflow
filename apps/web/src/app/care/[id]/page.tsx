import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { buttonClass } from "@/components/ui/ui";
import { CareDetail } from "@/components/care/care-detail";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { CareRecord, CareOptions } from "@/lib/care";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireServerRole("/care");
  const t = await getTranslations("people.care.hub");
  const { id } = await params;
  const query = await searchParams;
  const filters = new URLSearchParams();
  for (const key of ["page", "search", "kind", "dateFrom", "dateTo"])
    if (query[key]) filters.set(key, query[key]!);
  const [record, options] = await Promise.all([
    serverGet<CareRecord>(`/care/cases/${id}?${filters}`),
    serverGet<CareOptions>("/care/options"),
  ]);
  return (
    <Shell>
      <div>
        <Link href="/care" className={buttonClass("ghost", "sm")}>
          ← {t("careHub")}
        </Link>
      </div>
      <CareDetail
        key={`${record._id}-${record.eventPage}-${filters}`}
        initial={record}
        options={options}
      />
    </Shell>
  );
}
