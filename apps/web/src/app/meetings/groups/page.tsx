import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { Card, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { MeetingOptions } from "@/lib/meetings";
export default async function Page() {
  await requireServerRole("/meetings");
  const [options, t] = await Promise.all([
    serverGet<MeetingOptions>("/meetings/options"),
    getTranslations("services.meetings.groups"),
  ]);
  if (!options.isAdmin) redirect("/meetings");
  return (
    <Shell>
      <Link href="/meetings" className={buttonClass("secondary", "sm")}>
        {t("back")}
      </Link>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/meetings/groups/new" className={buttonClass()}>
            {t("add")}
          </Link>
        }
      />
      {options.groups.length === 0 && (
        <Card className="p-6">{t("empty")}</Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {options.groups.map((g) => (
          <Card className="p-6 space-y-3" key={g._id}>
            <p className="text-sm text-[#6b6b6b]">
              {typeof g.branchId === "object" ? g.branchId.name : ""} ·{" "}
              {g.enabled ? t("enabled") : t("disabled")}
            </p>
            <h2 className="text-xl font-semibold">{g.name}</h2>
            <p>
              {g.minutesRequired
                ? t("minutesRequiredWithin", { hours: g.minutesDueHours })
                : t("minutesOptional")}
            </p>
            <p className="text-sm">
              {t("counts", {
                submitters: g.submitterUserIds.length,
                reviewers: g.reviewerUserIds.length,
              })}
            </p>
            <Link
              className={buttonClass("secondary")}
              href={`/meetings/groups/${g._id}/edit`}
            >
              {t("editRequirements")}
            </Link>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
