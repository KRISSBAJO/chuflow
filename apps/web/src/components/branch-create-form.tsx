"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createdHref } from "@/lib/directory";
import { Button, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import {
  isDistrictRole,
  isGlobalRole,
} from "@/lib/permissions";
import type { DistrictOption, OversightRegionOption } from "@/lib/types";
import { useGeo } from "@/hooks/use-geo";

export function BranchCreateForm({
  currentUserRole,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
}: {
  currentUserRole: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const router = useRouter();
  const t = useTranslations("org.branchForm");
  const tCommon = useTranslations("common");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { country, currency, locale, states, timeZone } = useGeo();
  const [selectedOversightRegion, setSelectedOversightRegion] = useState(
    defaultOversightRegion || oversightRegions[0]?.name || "",
  );

  const availableDistricts = useMemo(() => {
    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    const region = isGlobalRole(currentUserRole)
      ? selectedOversightRegion
      : defaultOversightRegion;

    return districts.filter((district) => district.oversightRegion === region);
  }, [
    currentUserRole,
    defaultDistrict,
    defaultOversightRegion,
    districts,
    selectedOversightRegion,
  ]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          oversightRegion: formData.get("oversightRegion"),
          district: formData.get("district"),
          address: formData.get("address"),
          city: formData.get("city"),
          state: formData.get("state"),
          country: formData.get("country"),
          contactInfo: formData.get("contactInfo"),
          serviceTimes: formData.get("serviceTimes"),
          status: formData.get("status"),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || t("createError"));
      }

      setStatus(t("created"));
      router.push(createdHref(`/branches/${result._id}`, result, t("entityName")));
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("createError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-2xl bg-white p-5 sm:p-6">
      <h3 className="lp-heading text-[18px] leading-tight">{t("heading")}</h3>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
        {t("intro")}
      </p>
      <div className="mt-4 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[13px] leading-[1.6] text-[#55534e]">
        <span className="font-medium text-[#111111]">{t("regionalProfile")}</span>{" "}
        {country.name} · {currency.code} ({currency.symbol}) · {timeZone}
        <span className="block text-[12px] text-[#8a8780]">{t("browserLocale", { locale })}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label={t("branchName")} required>
          <input
            name="name"
            placeholder={t("branchName")}
            className="ui-input"
            required
          />
        </Field>

        {isGlobalRole(currentUserRole) ? (
          <Field label={tCommon("nationalArea")} required>
            <select
              name="oversightRegion"
              value={selectedOversightRegion}
              onChange={(event) => setSelectedOversightRegion(event.target.value)}
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
          </Field>
        ) : (
          <Field label={tCommon("nationalArea")}>
            <input
              type="hidden"
              name="oversightRegion"
              value={defaultOversightRegion ?? ""}
            />
            <input
              value={defaultOversightRegion || t("currentOversightRegion")}
              readOnly
              className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
            />
          </Field>
        )}

        {isDistrictRole(currentUserRole) ? (
          <Field label={tCommon("district")}>
            <input type="hidden" name="district" value={defaultDistrict ?? ""} />
            <input
              value={defaultDistrict || t("currentDistrict")}
              readOnly
              className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
            />
          </Field>
        ) : (
          <Field label={tCommon("district")} required>
            <select
              name="district"
              defaultValue=""
              className="ui-input"
              required
              disabled={availableDistricts.length === 0}
            >
              <option value="">
                {availableDistricts.length === 0
                  ? t("createDistrictFirst")
                  : t("selectDistrict")}
              </option>
              {availableDistricts.map((district) => (
                <option key={district._id} value={district.name}>
                  {district.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t("city")} required>
          <input
            name="city"
            placeholder={t("city")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("state")} required>
          <select
            name="state"
            defaultValue=""
            className="ui-input"
            required
          >
            <option value="">{t("selectState")}</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("country")}>
          <input type="hidden" name="country" value={country.name} />
          <input
            value={`${country.name} · ${currency.code}`}
            readOnly
            className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
          />
        </Field>
        <Field label={t("contactInfo")} required className="md:col-span-2">
          <input
            name="contactInfo"
            placeholder={t("contactPlaceholder")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("serviceTimes")} required className="md:col-span-2">
          <input
            name="serviceTimes"
            placeholder={t("serviceTimesPlaceholder")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={t("address")} required className="md:col-span-2">
          <input
            name="address"
            placeholder={t("addressPlaceholder")}
            className="ui-input"
            required
          />
        </Field>
        <Field label={tCommon("status")}>
          <input
            name="status"
            placeholder={tCommon("status")}
            defaultValue="active"
            className="ui-input"
          />
        </Field>
      </div>

      <p className="mt-4 text-[13px] leading-[1.6] text-[#8a8780]">
        {t.rich("managedFrom", {
          link: (chunks) => (
            <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2">
              {chunks}
            </a>
          ),
        })}
      </p>

      <Button
        type="submit"
        icon="plus"
        className="mt-5"
        disabled={loading || (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)}
      >
        {loading ? t("creating") : t("create")}
      </Button>
      {status ? (
        <p role="status" className="mt-4 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </form>
  );
}
