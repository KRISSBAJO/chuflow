import { notFound } from "next/navigation";
import { PublicIntakeForm } from "@/components/public-intake-form";
import { publicServerGet } from "@/lib/server-api";
import type { IntakeTemplate, PublicBranchOption } from "@/lib/types";

export default async function PublicIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ branchId?: string; oversightRegion?: string; district?: string }>;
}) {
  const { slug } = await params;
  const { branchId, oversightRegion, district } = await searchParams;

  let template: IntakeTemplate;
  let branchOptions: PublicBranchOption[];

  try {
    const query = new URLSearchParams();

    if (branchId) {
      query.set("branchId", branchId);
    }

    template = await publicServerGet<IntakeTemplate>(
      `/intake-templates/public/${slug}${query.toString() ? `?${query.toString()}` : ""}`,
    );
    const branchOptionQuery = new URLSearchParams();

    if (oversightRegion) {
      branchOptionQuery.set("oversightRegion", oversightRegion);
    }

    if (district) {
      branchOptionQuery.set("district", district);
    }

    branchOptions =
      (template.kind === "weekly_report" || template.kind === "maag_report") && !branchId
        ? await publicServerGet<PublicBranchOption[]>(
            `/intake-templates/public/branch-options${
              branchOptionQuery.toString() ? `?${branchOptionQuery.toString()}` : ""
            }`,
          ).catch(() => [])
        : [];
  } catch {
    notFound();
  }

  return (
    <PublicIntakeForm
      template={template}
      branchId={branchId}
      branchOptions={branchOptions}
      defaultOversightRegion={oversightRegion}
      defaultDistrict={district}
    />
  );
}
