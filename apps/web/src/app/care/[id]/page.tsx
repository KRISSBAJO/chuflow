import Link from "next/link";
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
  searchParams: Promise<{ page?: string }>;
}) {
  await requireServerRole("/care");
  const { id } = await params;
  const { page } = await searchParams;
  const [record, options] = await Promise.all([
    serverGet<CareRecord>(
      `/care/cases/${id}${page ? "?page=" + encodeURIComponent(page) : ""}`,
    ),
    serverGet<CareOptions>("/care/options"),
  ]);
  return (
    <Shell>
      <div>
        <Link href="/care" className={buttonClass("ghost", "sm")}>
          ← Care hub
        </Link>
      </div>
      <CareDetail
        key={`${record._id}-${record.eventPage}`}
        initial={record}
        options={options}
      />
    </Shell>
  );
}
