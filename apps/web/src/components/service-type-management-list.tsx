"use client";
import { ExportTableButtons } from "@/components/table-export";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { isBranchScopedRole } from "@/lib/permissions";
import type { BranchSummary, ServiceTypeSummary } from "@/lib/types";
import { Icon } from "@/components/app/icons";
import { Badge, Button, EmptyState, Field } from "@/components/ui/ui";

function getBranchId(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?._id;
}

function getBranchName(value: ServiceTypeSummary["branchId"]) {
  return typeof value === "string" ? value : value?.name;
}

export function ServiceTypeManagementList({
  serviceTypes,
  branches,
  currentUserRole,
}: {
  serviceTypes: ServiceTypeSummary[];
  branches: BranchSummary[];
  currentUserRole: string;
}) {
  const router = useRouter();
  const t = useTranslations("org.serviceTypes");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("statuses");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleSubmit(serviceTypeId: string, formData: FormData) {
    setLoadingId(serviceTypeId);

    try {
      const response = await fetch(
        `${API_URL}/service-types/${serviceTypeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            branchId:
              (formData.get(`branchId-${serviceTypeId}`) as string) ||
              undefined,
            name: formData.get(`name-${serviceTypeId}`),
            key: formData.get(`key-${serviceTypeId}`) || undefined,
            isActive: formData.get(`isActive-${serviceTypeId}`) === "on",
            notes: formData.get(`notes-${serviceTypeId}`) || undefined,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("updateError"));
      }

      toast.success(t("updatedTitle"), {
        description: t("updatedBody"),
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("updateError");
      toast.error(t("updateFailed"), {
        description: message,
      });
    } finally {
      setLoadingId(null);
    }
  }

  if (serviceTypes.length === 0) {
    return (
      <EmptyState icon="attendance" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <ExportTableButtons resource="service-types" rows={serviceTypes} />
      {serviceTypes.map((serviceType) => {
        const branchId = getBranchId(serviceType.branchId) || "";

        return (
          <details
            key={serviceType._id}
            className="group rounded-2xl border border-black/[0.06] bg-white transition-colors hover:border-black/[0.12] open:border-black/[0.12]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111111]">
                  {serviceType.name}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[#8a8780]">
                  {serviceType.key} ·{" "}
                  {getBranchName(serviceType.branchId) || t("branchScope")}
                </p>
              </div>
              <Badge tone={serviceType.isActive ? "success" : "neutral"} dot>
                {serviceType.isActive ? tStatuses("active") : tStatuses("inactive")}
              </Badge>
              <Icon
                name="chevronDown"
                className="h-4 w-4 shrink-0 text-[#8a8780] transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-black/[0.06] px-4 py-4">
              <form
                action={(formData) => handleSubmit(serviceType._id, formData)}
                className="grid gap-4 md:grid-cols-2"
              >
                {!isBranchScopedRole(currentUserRole) ? (
                  <Field label={tCommon("branch")}>
                    <select
                      name={`branchId-${serviceType._id}`}
                      defaultValue={branchId}
                      className="ui-input"
                    >
                      <option value="">{tCommon("selectBranch")}</option>
                      {branches.map((branch) => (
                        <option key={branch._id} value={branch._id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <input
                    type="hidden"
                    name={`branchId-${serviceType._id}`}
                    value={branchId}
                  />
                )}

                <Field label={t("displayName")}>
                  <input
                    name={`name-${serviceType._id}`}
                    defaultValue={serviceType.name}
                    className="ui-input"
                  />
                </Field>

                <Field label={t("key")}>
                  <input
                    name={`key-${serviceType._id}`}
                    defaultValue={serviceType.key}
                    className="ui-input"
                  />
                </Field>

                <Field label={tCommon("notes")} className="md:col-span-2">
                  <textarea
                    name={`notes-${serviceType._id}`}
                    defaultValue={serviceType.notes || ""}
                    className="ui-input"
                  />
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <label className="flex items-center gap-2 text-[14px] text-[#55534e]">
                    <input
                      type="checkbox"
                      name={`isActive-${serviceType._id}`}
                      defaultChecked={serviceType.isActive}
                      className="h-4 w-4 accent-[#111111]"
                    />
                    {t("activeType")}
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={loadingId === serviceType._id}
                  >
                    {loadingId === serviceType._id
                      ? tCommon("saving")
                      : t("update")}
                  </Button>
                </div>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
