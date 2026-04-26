"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    <form action={handleSubmit} className="rounded-[28px] bg-white p-6">
      <h3 className="text-xl font-semibold text-slate-950">Create branch</h3>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        United States profile loaded from <span className="font-semibold text-slate-900">useGeo</span>:{" "}
        {country.name} · {currency.code} ({currency.symbol}) · {timeZone}
        <span className="block text-xs text-slate-500">Browser locale: {locale}</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <input
          name="name"
          placeholder="Branch name"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        />

        {isGlobalRole(currentUserRole) ? (
          <select
            name="oversightRegion"
            value={selectedOversightRegion}
            onChange={(event) => setSelectedOversightRegion(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            required
          >
            <option value="">Select national area</option>
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
              name="oversightRegion"
              value={defaultOversightRegion ?? ""}
            />
            <input
              value={defaultOversightRegion || "Current oversight region"}
              readOnly
              className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
            />
          </>
        )}

        {isDistrictRole(currentUserRole) ? (
          <>
            <input type="hidden" name="district" value={defaultDistrict ?? ""} />
            <input
              value={defaultDistrict || "Current district"}
              readOnly
              className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
            />
          </>
        ) : (
          <select
            name="district"
            defaultValue=""
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
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
        )}

        <input
          name="city"
          placeholder="City"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        />
        <select
          name="state"
          defaultValue=""
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          required
        >
          <option value="">Select state</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name} ({state.code})
            </option>
          ))}
        </select>
        <>
          <input type="hidden" name="country" value={country.name} />
          <input
            value={`${country.name} · ${currency.code}`}
            readOnly
            className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
          />
        </>
        <input
          name="contactInfo"
          placeholder="Contact info"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
          required
        />
        <input
          name="serviceTimes"
          placeholder="Service times"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
          required
        />
        <input
          name="address"
          placeholder="Address"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none md:col-span-2"
          required
        />
        <input
          name="status"
          placeholder="Status"
          defaultValue="active"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        National areas and districts are managed from{" "}
        <a href="/structure" className="font-semibold text-slate-900 underline">
          Structure
        </a>
        , then selected here for the branch.
      </p>

      <button
        type="submit"
        disabled={loading || (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)}
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
      >
        {loading ? "Creating..." : "Create branch"}
      </button>
      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
