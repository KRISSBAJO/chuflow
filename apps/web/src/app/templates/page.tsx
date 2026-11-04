import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { TemplateEditorCard } from "@/components/template-editor-card";
import { TemplateManagementList } from "@/components/template-management-list";
import { Badge, Card, CardHeader } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type { BranchSummary, IntakeTemplate } from "@/lib/types";

export default async function TemplatesPage() {
  const user = await requireServerRole("/templates");

  const [templates, branches] = await Promise.all([
    serverGet<IntakeTemplate[]>("/intake-templates"),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
  ]);

  const activeTemplates = templates.filter((template) => template.isActive).length;
  const guestTemplates = templates.filter((template) => template.kind === "guest").length;
  const memberTemplates = templates.filter((template) => template.kind === "member").length;
  const attendanceTemplates = templates.filter((template) => template.kind === "attendance").length;
  const weeklyReportTemplates = templates.filter((template) => template.kind === "weekly_report").length;

  return (
    <Shell>
      <PageHeader
        eyebrow="Templates"
        title="Intake templates and public links"
        description="Manage first-timer, member, attendance and weekly report templates: wording, field structure, live public links and scannable QR codes."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Templates" value={String(templates.length)} delta="Total template definitions" tone="cool" />
        <MetricCard label="Active public links" value={String(activeTemplates)} delta="Currently live templates" tone="warm" />
        <MetricCard label="Guest / member" value={`${guestTemplates}/${memberTemplates}`} delta="First-timer and member forms" tone="cool" />
        <MetricCard label="Reports" value={`${attendanceTemplates}/${weeklyReportTemplates}`} delta="Attendance and weekly indices" tone="warm" />
      </section>
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="app-rise min-w-0 p-6 sm:p-7">
          <CardHeader
            label="Library"
            title="Template library"
            description="Seeded templates are ready to use, and you can activate branch-specific variations whenever you need them."
            action={<Badge tone="flame">QR and share ready</Badge>}
          />
          <div className="mt-6">
            <TemplateManagementList
              templates={templates}
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
              defaultOversightRegion={user.oversightRegion}
              defaultDistrict={user.district}
            />
          </div>
        </Card>
        <Card className="app-rise min-w-0 p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader
            label="Create template"
            title="Build a new intake flow"
            description="Create a public form, choose its fields, connect it to a branch, and make it the active template when you are ready."
          />
          <div className="mt-6">
            <TemplateEditorCard
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
              defaultOversightRegion={user.oversightRegion}
              defaultDistrict={user.district}
            />
          </div>
        </Card>
      </section>
    </Shell>
  );
}
