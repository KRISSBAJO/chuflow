"use client";
import { useTranslations } from "next-intl";
import { ExportTableButtons } from "@/components/table-export";

export function ExportMenu({
  resource,
  rows,
  filters,
}: {
  resource: string;
  rows?: unknown[];
  filters?: Record<string, string>;
}) {
  const t = useTranslations("workspace");
  return (
    <details className="relative w-fit rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm">
      <summary className="cursor-pointer font-medium">{t("export")}</summary>
      <div className="mt-3 max-w-full border-t border-black/5 pt-3">
        <ExportTableButtons
          resource={resource}
          rows={rows}
          filters={filters}
          label=""
        />
      </div>
    </details>
  );
}
