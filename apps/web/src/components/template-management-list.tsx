"use client";
import { TemplateEditorCard } from "./template-editor-card";
import { Icon } from "@/components/app/icons";
import { Badge, EmptyState, formatStatus } from "@/components/ui/ui";
import type { BranchSummary, IntakeTemplate } from "@/lib/types";

export function TemplateManagementList({
  templates,
  branches,
  currentUserRole,
  defaultBranchId,
  defaultOversightRegion,
  defaultDistrict,
}: {
  templates: IntakeTemplate[];
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
}) {
  const branchNameById = new Map(branches.map((branch) => [branch._id, branch.name]));

  if (templates.length === 0) {
    return (
      <EmptyState icon="templates" title="No templates yet">
        Create your first intake template to get a public link and QR code.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((template) => {
        const isDistrictVersion = !!template.district && !!template.oversightRegion;
        const isGlobalBase = !template.branchId && !template.isBranchOverride && !isDistrictVersion;
        const isReadOnly = currentUserRole !== "super_admin" && isGlobalBase;
        const branchLabel = template.branchId ? branchNameById.get(template.branchId) : undefined;
        const scopeLabel = isGlobalBase ? "Global base" : isDistrictVersion ? "District version" : "Branch version";

        return (
          <details
            key={template._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors open:border-black/[0.12] hover:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[#111111]">
                    {template.name}
                    {!isGlobalBase && branchLabel ? ` · ${branchLabel}` : ""}
                    {isDistrictVersion ? ` · ${template.district}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                    {formatStatus(template.kind)} · /intake/{template.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{scopeLabel}</Badge>
                  {!isGlobalBase && branchLabel ? <Badge tone="info">{branchLabel}</Badge> : null}
                  {isDistrictVersion ? <Badge tone="info">{template.district}</Badge> : null}
                  <Badge>{formatStatus(template.kind)}</Badge>
                  <Badge tone={template.isActive ? "success" : "neutral"} dot>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {template.isSeeded ? <Badge tone="flame">Seeded</Badge> : null}
                </div>
              </div>
              <Icon
                name="chevronDown"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-5">
              <TemplateEditorCard
                template={template}
                branches={branches}
                currentUserRole={currentUserRole}
                defaultBranchId={defaultBranchId}
                defaultOversightRegion={defaultOversightRegion}
                defaultDistrict={defaultDistrict}
                readonly={isReadOnly}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
