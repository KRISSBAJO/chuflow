import { notFound } from "next/navigation";
import { PublicIntakeForm } from "@/components/public-intake-form";
import { publicServerGet } from "@/lib/server-api";
import type { IntakeTemplate } from "@/lib/types";

export default async function PublicIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { slug } = await params;
  const { branchId } = await searchParams;

  try {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    const template = await publicServerGet<IntakeTemplate>(
      `/intake-templates/public/${slug}${query}`,
    );
    return <PublicIntakeForm template={template} branchId={branchId} />;
  } catch {
    notFound();
  }
}
