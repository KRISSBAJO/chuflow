import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { AttendanceCreateForm } from "@/components/attendance-create-form";
import { Card } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  ServiceTypeSummary,
  ServiceScheduleSummary,
} from "@/lib/types";
import { redirect } from "next/navigation";
export default async function Page() {
  const user = await requireServerRole("/attendance");
  if (user.role === "follow_up") redirect("/attendance");
  const [t, branches, types, schedules] = await Promise.all([
    getTranslations("workspace"),
    serverGet<BranchSummary[]>("/branches/options"),
    serverGet<ServiceTypeSummary[]>("/service-types"),
    serverGet<ServiceScheduleSummary[]>("/service-schedules"),
  ]);
  return (
    <Shell>
      <Link href="/attendance" className="text-sm text-[#6b6b6b]">
        ← {t("backAttendance")}
      </Link>
      <PageHeader
        eyebrow={t("attendance")}
        title={t("recordAttendance")}
        description={t("sectionHint")}
      />
      <Card className="mx-auto w-full max-w-4xl p-6">
        <AttendanceCreateForm
          branches={branches}
          serviceTypes={types}
          serviceSchedules={schedules}
          defaultBranchId={user.branchId}
          returnHref="/attendance?tab=summaries"
        />
      </Card>
    </Shell>
  );
}
