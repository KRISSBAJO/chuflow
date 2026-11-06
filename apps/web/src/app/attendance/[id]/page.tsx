import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { Card, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { safeReturnTo } from "@/lib/workspace-navigation";
import type {
  AttendanceItem,
  BranchSummary,
  ServiceTypeSummary,
  ServiceScheduleSummary,
} from "@/lib/types";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; edit?: string }>;
}) {
  const user = await requireServerRole("/attendance");
  const { id } = await params;
  const q = await searchParams;
  const [record, branches, types, schedules, t, tw, f] = await Promise.all([
    serverGet<AttendanceItem>(`/attendance/${id}`),
    serverGet<BranchSummary[]>("/branches/options"),
    serverGet<ServiceTypeSummary[]>("/service-types"),
    serverGet<ServiceScheduleSummary[]>("/service-schedules"),
    getTranslations("services.attendance.summaries"),
    getTranslations("workspace"),
    getFormatter(),
  ]);
  const back = safeReturnTo(q.returnTo, "/attendance");
  const self = `/attendance/${id}?returnTo=${encodeURIComponent(back)}`;
  const fields = [
    ["men", record.menCount],
    ["women", record.womenCount],
    ["children", record.childrenCount],
    ["adults", record.adultsCount],
    ["firstTimers", record.firstTimersCount],
    ["newConverts", record.newConvertsCount],
    ["holySpirit", record.holySpiritBaptismCount],
  ] as const;
  return (
    <Shell>
      <Link href={back} className="text-sm text-[#6b6b6b]">
        ← {tw("backAttendance")}
      </Link>
      <PageHeader
        eyebrow={tw("attendance")}
        title={
          record.serviceName || record.serviceTypeLabel || record.serviceType
        }
        description={f.dateTime(new Date(record.serviceDate), {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        action={
          user.role !== "follow_up" && q.edit !== "1" ? (
            <Link href={self + "&edit=1"} className={buttonClass("secondary")}>
              {tw("edit")}
            </Link>
          ) : undefined
        }
      />
      {q.edit === "1" && user.role !== "follow_up" ? (
        <Card className="mx-auto w-full max-w-4xl p-6">
          <div className="mb-5">
            <Link href={self} className={buttonClass("secondary", "sm")}>
              {tw("cancel")}
            </Link>
          </div>
          <AttendanceCreateForm
            record={record}
            branches={branches}
            serviceTypes={types}
            serviceSchedules={schedules}
            defaultBranchId={user.branchId}
            returnHref={self}
          />
        </Card>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-[#6b6b6b]">
            {typeof record.branchId === "object"
              ? record.branchId?.name
              : branches.find((b) => b._id === record.branchId)?.name}
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white p-4">
                <dt className="text-xs text-[#8a8780]">
                  {t(`columns.${label}`)}
                </dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                  {f.number(value || 0)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </Shell>
  );
}
