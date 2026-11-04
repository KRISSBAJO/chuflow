"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { DistrictOption, OversightRegionOption } from "@/lib/types";

export function DistrictEditorCard({
  district,
  oversightRegions,
  canEdit,
  canChangeOversightRegion,
}: {
  district: DistrictOption;
  oversightRegions: OversightRegionOption[];
  canEdit: boolean;
  canChangeOversightRegion: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/districts/${district._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oversightRegion: formData.get("oversightRegion"),
          name: formData.get("name"),
          isActive: formData.get("isActive") === "active",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to update district");
      }

      setStatus("District updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update district");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="District"
        title={district.name}
        description={
          <>
            {district.oversightRegion} ·{" "}
            <span className="tabular-nums">{district.branchCount}</span> branches
          </>
        }
        action={
          <Badge tone={district.isActive ? "success" : "neutral"} dot>
            {district.isActive ? "Active" : "Inactive"}
          </Badge>
        }
      />

      {canEdit ? (
        <form action={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          {canChangeOversightRegion ? (
            <Field label="National area">
              <select
                name="oversightRegion"
                defaultValue={district.oversightRegion}
                className="ui-input"
              >
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
                value={district.oversightRegion}
              />
              <input
                value={district.oversightRegion}
                readOnly
                className="ui-input bg-[#f6f5f1] text-[#6b6b6b]"
              />
            </Field>
          )}
          <Field label="District name" required>
            <input
              name="name"
              defaultValue={district.name}
              className="ui-input"
              required
            />
          </Field>
          <Field label="Status">
            <select
              name="isActive"
              defaultValue={district.isActive ? "active" : "inactive"}
              className="ui-input"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save district"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]">
          You can view this district, but only a district admin, national admin or overall oversight admin can edit it.
        </p>
      )}

      {status ? (
        <p role="status" className="mt-4 text-[14px] text-[#55534e]">
          {status}
        </p>
      ) : null}
    </Card>
  );
}
