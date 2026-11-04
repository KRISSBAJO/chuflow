"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, Field } from "@/components/ui/ui";
import { API_URL } from "@/lib/api";
import type { OversightRegionOption } from "@/lib/types";

export function OversightRegionEditorCard({
  region,
  canEdit,
}: {
  region: OversightRegionOption;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/oversight-regions/${region._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.get("name"),
          isActive: formData.get("isActive") === "active",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to update national area");
      }

      setStatus("National area updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update national area",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="app-rise p-6 sm:p-7">
      <CardHeader
        label="National area"
        title={region.name}
        description={
          <>
            <span className="tabular-nums">{region.districtCount}</span> districts ·{" "}
            <span className="tabular-nums">{region.branchCount}</span> branches
          </>
        }
        action={
          <Badge tone={region.isActive ? "success" : "neutral"} dot>
            {region.isActive ? "Active" : "Inactive"}
          </Badge>
        }
      />

      {canEdit ? (
        <form action={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="National area name" required>
            <input
              name="name"
              defaultValue={region.name}
              className="ui-input"
              required
            />
          </Field>
          <Field label="Status">
            <select
              name="isActive"
              defaultValue={region.isActive ? "active" : "inactive"}
              className="ui-input"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save national area"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]">
          You can view this national area, but only a national admin or overall oversight admin can edit it.
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
