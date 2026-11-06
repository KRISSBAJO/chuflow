"use client";
import { toast } from "sonner";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
} from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import { isGlobalRole } from "@/lib/permissions";
import type { DistrictOption, OversightRegionOption } from "@/lib/types";

export function HierarchyCatalogPanel({
  currentUserRole,
  defaultOversightRegion,
  oversightRegions,
  districts,
}: {
  currentUserRole: string;
  defaultOversightRegion?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const router = useRouter();
  const t = useTranslations("org.hierarchyCatalog");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState<"region" | "district" | null>(null);

  const [selectedRegion, setSelectedRegion] = useState(
    defaultOversightRegion || oversightRegions[0]?.name || "",
  );
  const canCreateRegion = currentUserRole === "super_admin";
  const canCreateDistrict =
    currentUserRole === "super_admin" || currentUserRole === "national_admin";

  const visibleDistricts = useMemo(
    () =>
      districts.filter(
        (district) =>
          !selectedRegion || district.oversightRegion === selectedRegion,
      ),
    [districts, selectedRegion],
  );

  async function handleCreateRegion(formData: FormData) {
    setLoading("region");

    try {
      const response = await fetch(`${API_URL}/oversight-regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("regionName"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t("createRegionError"));
      }

      toast.success(t("regionCreated"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("createRegionError"),
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleCreateDistrict(formData: FormData) {
    setLoading("district");

    try {
      const response = await fetch(`${API_URL}/districts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oversightRegion:
            formData.get("districtOversightRegion") || defaultOversightRegion,
          name: formData.get("districtName"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t("createDistrictError"));
      }

      toast.success(t("districtCreated"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("createDistrictError"),
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label={t("label")}
        title={t("title")}
        description={t("description")}
      />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                <Icon name="structure" className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="lp-heading text-[17px]">{t("nationalAreas")}</h3>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">
                  {t("nationalAreasHint")}
                </p>
              </div>
            </div>
            <Badge tone="flame">
              {t.rich("areasCount", {
                count: oversightRegions.length,
                n: (chunks) => <span className="tabular-nums">{chunks}</span>,
              })}
            </Badge>
          </div>

          {canCreateRegion ? (
            <form
              action={handleCreateRegion}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                name="regionName"
                placeholder={t("newAreaName")}
                aria-label={t("newAreaName")}
                className="ui-input flex-1"
                required
              />
              <Button type="submit" icon="plus" disabled={loading === "region"}>
                {loading === "region" ? t("creating") : tCommon("create")}
              </Button>
            </form>
          ) : null}

          <div className="mt-4">
            {oversightRegions.length > 0 ? (
              <ul className="divide-y divide-black/[0.05]">
                {oversightRegions.map((region) => (
                  <li key={region._id}>
                    <Link
                      href={`/structure/national/${region._id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[#111111]">
                          {region.name}
                        </span>
                        <span className="block text-[13px] text-[#6b6b6b]">
                          {t.rich("regionSummary", {
                            districts: region.districtCount,
                            branches: region.branchCount,
                            n: (chunks) => (
                              <span className="tabular-nums">{chunks}</span>
                            ),
                          })}
                        </span>
                      </span>
                      <Icon
                        name="arrowRight"
                        className="h-4 w-4 text-[#8a8780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#111111]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="structure" title={t("noAreasTitle")}>
                {t("noAreasBody")}
              </EmptyState>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.06] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f5f1] text-[#111111]">
                <Icon name="pin" className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="lp-heading text-[17px]">{t("districts")}</h3>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6b6b6b]">
                  {t("districtsHint")}
                </p>
              </div>
            </div>
            <Badge>
              {t.rich("districtsCount", {
                count: districts.length,
                n: (chunks) => <span className="tabular-nums">{chunks}</span>,
              })}
            </Badge>
          </div>

          {canCreateDistrict ? (
            <form action={handleCreateDistrict} className="mt-4 grid gap-2">
              {isGlobalRole(currentUserRole) ? (
                <select
                  name="districtOversightRegion"
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  aria-label={tCommon("nationalArea")}
                  className="ui-input"
                  required
                >
                  <option value="">{t("selectNationalArea")}</option>
                  {oversightRegions.map((region) => (
                    <option key={region._id} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="hidden"
                    name="districtOversightRegion"
                    value={defaultOversightRegion || ""}
                  />
                  <input
                    value={defaultOversightRegion || t("currentNationalArea")}
                    readOnly
                    aria-label={tCommon("nationalArea")}
                    className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
                  />
                </>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  name="districtName"
                  placeholder={t("newDistrictName")}
                  aria-label={t("newDistrictName")}
                  className="ui-input flex-1"
                  required
                />
                <Button
                  type="submit"
                  icon="plus"
                  disabled={loading === "district"}
                >
                  {loading === "district" ? t("creating") : tCommon("create")}
                </Button>
              </div>
            </form>
          ) : null}

          <div className="mt-4">
            {visibleDistricts.length > 0 ? (
              <ul className="divide-y divide-black/[0.05]">
                {visibleDistricts.map((district) => (
                  <li key={district._id}>
                    <Link
                      href={`/structure/district/${district._id}`}
                      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[#f6f5f1]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-[#111111]">
                          {district.name}
                        </span>
                        <span className="block text-[13px] text-[#6b6b6b]">
                          {t.rich("districtSummary", {
                            region: district.oversightRegion,
                            count: district.branchCount,
                            n: (chunks) => (
                              <span className="tabular-nums">{chunks}</span>
                            ),
                          })}
                        </span>
                      </span>
                      <Icon
                        name="arrowRight"
                        className="h-4 w-4 text-[#8a8780] transition-transform group-hover:translate-x-0.5 group-hover:text-[#111111]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="pin" title={t("noDistrictsTitle")}>
                {t("noDistrictsBody")}
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
