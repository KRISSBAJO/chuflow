"use client";
import { TemplateEditorCard } from "./template-editor-card";
import type { BranchSummary, IntakeTemplate } from "@/lib/types";

export function TemplateManagementList({
  templates,
  branches,
  currentUserRole,
  defaultBranchId,
}: {
  templates: IntakeTemplate[];
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
}) {
  const branchNameById = new Map(branches.map((branch) => [branch._id, branch.name]));

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const isGlobalBase = !template.branchId && !template.isBranchOverride;
        const isReadOnly = currentUserRole !== "super_admin" && isGlobalBase;
        const branchLabel = template.branchId ? branchNameById.get(template.branchId) : undefined;
        const scopeLabel = isGlobalBase ? "global base" : "branch version";

        return (
          <details key={template._id} className="rounded-[22px] border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {template.name}
                    {!isGlobalBase && branchLabel ? ` · ${branchLabel}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {template.kind} · /intake/{template.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {scopeLabel}
                  </span>
                  {!isGlobalBase && branchLabel ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                      {branchLabel}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                    {template.kind}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      template.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {template.isActive ? "active" : "inactive"}
                  </span>
                  {template.isSeeded ? (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                      seeded
                    </span>
                  ) : null}
                </div>
              </div>
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <TemplateEditorCard
                template={template}
                branches={branches}
                currentUserRole={currentUserRole}
                defaultBranchId={defaultBranchId}
                readonly={isReadOnly}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
