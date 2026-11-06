import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import { browseDirectory, type DirectoryParams } from "@/lib/directory";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TemplateManagementList } from "@/components/template-management-list";
import { Badge, buttonClass, Card, CardHeader } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, IntakeTemplate } from "@/lib/types";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const params = await searchParams;
  const user = await requireServerRole("/templates");
  const t = await getTranslations("admin.templates");
  const tc = await getTranslations("common");
  const ts = await getTranslations("statuses");

  const [templates, branches] = await Promise.all([
    serverGet<IntakeTemplate[]>("/intake-templates"),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
  ]);

  const activeTemplates = templates.filter(
    (template) => template.isActive,
  ).length;
  const guestTemplates = templates.filter(
    (template) => template.kind === "guest",
  ).length;
  const memberTemplates = templates.filter(
    (template) => template.kind === "member",
  ).length;
  const attendanceTemplates = templates.filter(
    (template) => template.kind === "attendance",
  ).length;
  const weeklyReportTemplates = templates.filter(
    (template) => template.kind === "weekly_report",
  ).length;

  const directory = browseDirectory(
    templates,
    params,
    (template) =>
      [template.name, template.kind, template.slug, template.title].join(" "),
    (template) => template.name,
    {
      status: (template) => (template.isActive ? "active" : "inactive"),
      kind: (template) => template.kind,
      branchId: (template) => template.branchId || "global",
    },
  );
  const directoryFilters = [
    {
      key: "status",
      label: tc("status"),
      options: [
        { value: "active", label: ts("active") },
        { value: "inactive", label: ts("inactive") },
      ],
    },
    {
      key: "kind",
      label: t("filters.formType"),
      options: (
        [
          "guest",
          "member",
          "attendance",
          "weekly_report",
          "maag_report",
        ] as const
      ).map((value) => ({ value, label: t(`kinds.${value}`) })),
    },
    {
      key: "branchId",
      label: tc("branch"),
      options: [
        { value: "global", label: t("filters.sharedGlobal") },
        ...branches.map((branch) => ({
          value: branch._id,
          label: branch.name,
        })),
      ],
    },
  ];
  return (
    <Shell>
      <PageHeader
        action={
          <Link href="/templates/new" className={buttonClass("primary")}>
            {t("create")}
          </Link>
        }
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("metrics.templates")}
          value={String(templates.length)}
          delta={t("metrics.templatesDelta")}
          tone="cool"
        />
        <MetricCard
          label={t("metrics.activeLinks")}
          value={String(activeTemplates)}
          delta={t("metrics.activeLinksDelta")}
          tone="warm"
        />
        <MetricCard
          label={t("metrics.guestMember")}
          value={`${guestTemplates}/${memberTemplates}`}
          delta={t("metrics.guestMemberDelta")}
          tone="cool"
        />
        <MetricCard
          label={t("metrics.reports")}
          value={`${attendanceTemplates}/${weeklyReportTemplates}`}
          delta={t("metrics.reportsDelta")}
          tone="warm"
        />
      </section>
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label={t("libraryLabel")}
            title={t("libraryTitle")}
            description={t("libraryDescription")}
            action={<Badge tone="flame">{t("qrReady")}</Badge>}
          />
          <div className="mt-6">
            <DirectoryControls
              path="/templates"
              params={params}
              filters={directoryFilters}
            />
            <TemplateManagementList
              templates={directory.items}
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
              defaultOversightRegion={user.oversightRegion}
              defaultDistrict={user.district}
            />
            <DirectoryPagination
              path="/templates"
              params={params}
              {...directory}
            />
          </div>
        </Card>
      </section>
    </Shell>
  );
}
