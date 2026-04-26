import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";
import { TemplateEditorCard } from "@/components/template-editor-card";
import { TemplateManagementList } from "@/components/template-management-list";
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

  return (
    <Shell>
      <PageHeader
        eyebrow="Templates"
        title="Dynamic intake templates and public share links"
        description="Manage branded first timer, member, and attendance templates with editable wording, field structure, active public links, and scannable QR access."
      />
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Templates" value={String(templates.length)} delta="Total template definitions" tone="cool" />
        <MetricCard label="Active public links" value={String(activeTemplates)} delta="Currently live templates" tone="warm" />
        <MetricCard label="Guest / member" value={`${guestTemplates}/${memberTemplates}`} delta="First-timer and member forms" tone="cool" />
        <MetricCard label="Attendance" value={String(attendanceTemplates)} delta="Service summary forms" tone="warm" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface rounded-[24px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Template library</h2>
              <p className="mt-1 text-xs text-slate-500">Seeded templates are ready, and you can activate branch-specific variations whenever you want.</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              QR + share ready
            </div>
          </div>
          <div className="mt-4">
            <TemplateManagementList
              templates={templates}
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
            />
          </div>
        </section>
        <section className="space-y-4">
          <section className="surface rounded-[24px] p-5">
            <p className="eyebrow">Create template</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Build a new intake flow</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create a new public form, choose its field structure, connect it to a branch, and make
              it the active template whenever you are ready.
            </p>
          </section>
          <section className="surface rounded-[24px] p-4">
            <TemplateEditorCard
              branches={branches}
              currentUserRole={user.role}
              defaultBranchId={user.branchId}
            />
          </section>
        </section>
      </section>
    </Shell>
  );
}
