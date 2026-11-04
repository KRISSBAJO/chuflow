"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
        throw new Error(result.message || "Unable to create branch");
      }

      setStatus("Branch created successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create branch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-2xl bg-white p-5 sm:p-6">
      <h3 className="lp-heading text-[18px] leading-tight">Create branch</h3>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-[#6b6b6b]">
        Add a branch under one of your districts.
      </p>
      <div className="mt-4 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[13px] leading-[1.6] text-[#55534e]">
        <span className="font-medium text-[#111111]">Regional profile:</span>{" "}
        {country.name} · {currency.code} ({currency.symbol}) · {timeZone}
        <span className="block text-[12px] text-[#8a8780]">Browser locale: {locale}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Branch name" required>
          <input
            name="name"
            placeholder="Branch name"
            className="ui-input"
            required
          />
        </Field>

        {isGlobalRole(currentUserRole) ? (
          <Field label="National area" required>
            <select
              name="oversightRegion"
              value={selectedOversightRegion}
              onChange={(event) => setSelectedOversightRegion(event.target.value)}
              className="ui-input"
              required
            >
              <option value="">Select national area</option>
              {oversightRegions.map((region) => (
                <option key={region._id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="National area">
            <input
              type="hidden"
              name="oversightRegion"
              value={defaultOversightRegion ?? ""}
            />
            <input
              value={defaultOversightRegion || "Current oversight region"}
              readOnly
              className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
            />
          </Field>
        )}

        {isDistrictRole(currentUserRole) ? (
          <Field label="District">
            <input type="hidden" name="district" value={defaultDistrict ?? ""} />
            <input
              value={defaultDistrict || "Current district"}
              readOnly
              className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
            />
          </Field>
        ) : (
          <Field label="District" required>
            <select
              name="district"
              defaultValue=""
              className="ui-input"
              required
              disabled={availableDistricts.length === 0}
            >
              <option value="">
                {availableDistricts.length === 0
                  ? "Create district first"
                  : "Select district"}
              </option>
              {availableDistricts.map((district) => (
                <option key={district._id} value={district.name}>
                  {district.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="City" required>
          <input
            name="city"
            placeholder="City"
            className="ui-input"
            required
          />
        </Field>
        <Field label="State" required>
          <select
            name="state"
            defaultValue=""
            className="ui-input"
            required
          >
            <option value="">Select state</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country">
          <input type="hidden" name="country" value={country.name} />
          <input
            value={`${country.name} · ${currency.code}`}
            readOnly
            className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
          />
        </Field>
        <Field label="Contact info" required className="md:col-span-2">
          <input
            name="contactInfo"
            placeholder="Phone or email"
            className="ui-input"
            required
          />
        </Field>
        <Field label="Service times" required className="md:col-span-2">
          <input
            name="serviceTimes"
            placeholder="e.g. Sundays 9:00 AM and 11:00 AM"
            className="ui-input"
            required
          />
        </Field>
        <Field label="Address" required className="md:col-span-2">
          <input
            name="address"
            placeholder="Street address"
            className="ui-input"
            required
          />
        </Field>
        <Field label="Status">
          <input
            name="status"
            placeholder="Status"
            defaultValue="active"
            className="ui-input"
          />
        </Field>
      </div>

      <p className="mt-4 text-[13px] leading-[1.6] text-[#8a8780]">
        National areas and districts are managed from{" "}
        <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2">
          Structure
        </a>
        , then selected here for the branch.
      </p>

      <Button
        type="submit"
        icon="plus"
        className="mt-5"
        disabled={loading || (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)}
      >
        {loading ? "Creating..." : "Create branch"}
      </Button>
      {status ? (
        <p role="status" className="mt-4 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </form>
  );
}
