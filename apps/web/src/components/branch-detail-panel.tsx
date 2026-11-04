"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { Icon } from "@/components/app/icons";
import { PastoralLeadershipCard, TeamPills } from "@/components/structure-cards";
import { Button, buttonClass, Card, CardHeader, Field, Stat } from "@/components/ui/ui";
import { ShareLinkCard } from "@/components/share-link-card";
import {
  canManageBranchStructure,
  isDistrictRole,
  isGlobalRole,
} from "@/lib/permissions";
import type {
  BranchOverview,
  DistrictOption,
  IntakeTemplate,
  OversightRegionOption,
} from "@/lib/types";

function withBranchQuery(url: string, branchId: string) {
  const parsed = new URL(url, "https://www.chuflow.com");
  parsed.searchParams.set("branchId", branchId);

  return url.startsWith("http") ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
}

export function BranchDetailPanel({
  branch,
  currentUserRole,
  defaultOversightRegion,
  defaultDistrict,
  oversightRegions,
  districts,
  templates,
}: {
  branch: BranchOverview;
  currentUserRole: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
  templates: IntakeTemplate[];
}) {
  const router = useRouter();
  const canEdit = canManageBranchStructure(currentUserRole);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(
    defaultOversightRegion || branch.oversightRegion,
  );
  const attendanceTemplate = templates.find(
    (template) =>
      template.kind === "attendance" &&
      template.isActive &&
      template.branchId === branch._id,
  ) || templates.find((template) => template.kind === "attendance" && template.isActive);
  const attendanceShareUrl = attendanceTemplate
    ? withBranchQuery(attendanceTemplate.shareUrl || `/intake/${attendanceTemplate.slug}`, branch._id)
    : null;
  const weeklyReportTemplate = templates.find(
    (template) =>
      template.kind === "weekly_report" &&
      template.isActive &&
      template.branchId === branch._id,
  ) || templates.find(
    (template) =>
      template.kind === "weekly_report" &&
      template.isActive &&
      template.oversightRegion === branch.oversightRegion &&
      template.district === branch.district,
  ) || templates.find((template) => template.kind === "weekly_report" && template.isActive);
  const weeklyReportShareUrl = weeklyReportTemplate
    ? withBranchQuery(weeklyReportTemplate.shareUrl || `/intake/${weeklyReportTemplate.slug}`, branch._id)
    : null;
  const maagReportTemplate = templates.find(
    (template) =>
      template.kind === "maag_report" &&
      template.isActive &&
      template.branchId === branch._id,
  ) || templates.find(
    (template) =>
      template.kind === "maag_report" &&
      template.isActive &&
      template.oversightRegion === branch.oversightRegion &&
      template.district === branch.district,
  ) || templates.find((template) => template.kind === "maag_report" && template.isActive);
  const maagReportShareUrl = maagReportTemplate
    ? withBranchQuery(maagReportTemplate.shareUrl || `/intake/${maagReportTemplate.slug}`, branch._id)
    : null;

  const availableDistricts = useMemo(() => {
    if (isDistrictRole(currentUserRole) && defaultDistrict) {
      return districts.filter((district) => district.name === defaultDistrict);
    }

    const region = isGlobalRole(currentUserRole)
      ? selectedRegion
      : defaultOversightRegion || branch.oversightRegion;

    return districts.filter((district) => district.oversightRegion === region);
  }, [
    branch.oversightRegion,
    currentUserRole,
    defaultDistrict,
    defaultOversightRegion,
    districts,
    selectedRegion,
  ]);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_URL}/branches/${branch._id}`, {
        method: "PATCH",
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
        throw new Error(result.message || "Unable to update branch");
      }

      setStatus("Branch updated successfully.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update branch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader label="Operating snapshot" title="Branch at a glance" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Guests", branch.metrics.guestCount],
              ["Members", branch.metrics.memberCount],
              ["Branch admins", branch.metrics.branchAdminCount],
              ["Support team", branch.metrics.followUpCount + branch.metrics.usherCount],
            ].map(([label, value]) => (
              <Stat key={label} label={String(label)} value={value} />
            ))}
          </div>
        </Card>

        <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
          <CardHeader
            label="Leadership"
            title="Branch team"
            description="Who leads and supports this branch today."
          />
          <div className="mt-5 space-y-4">
            <TeamBlock title="Branch admins" users={branch.admins} empty="No branch admin assigned." />
            <PastoralLeadershipCard
              residentPastors={branch.residentPastors}
              associatePastors={branch.associatePastors}
            />
            <TeamBlock title="Follow-up team" users={branch.followUpTeam} empty="No follow-up staff assigned." />
            <TeamBlock title="Usher team" users={branch.ushers} empty="No usher staff assigned." />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/users?branchId=${branch._id}`} className={buttonClass("primary", "md")}>
              <Icon name="users" className="h-4 w-4" />
              Open branch staff
            </a>
            <a href={`/guests?branchId=${branch._id}`} className={buttonClass("secondary", "md")}>
              <Icon name="guests" className="h-4 w-4" />
              Open branch guests
            </a>
          </div>
        </Card>

        {attendanceShareUrl || weeklyReportShareUrl || maagReportShareUrl ? (
          <Card className="app-rise p-6 sm:p-7" style={{ animationDelay: "120ms" }}>
            <CardHeader
              label="Share links"
              title="Reporting forms"
              description="Branch-scoped links you can send to leaders and service teams."
            />
            <div className="mt-5 space-y-3">
              {attendanceShareUrl ? (
                <ShareLinkCard
                  title="Attendance entry link"
                  url={attendanceShareUrl}
                  description="Share this with branch staff or service leads for attendance submission."
                />
              ) : null}
              {weeklyReportShareUrl ? (
                <ShareLinkCard
                  title="Weekly report link"
                  url={weeklyReportShareUrl}
                  description="Send this branch-scoped spiritual indices report to branch leaders for weekly district reporting."
                />
              ) : null}
              {maagReportShareUrl ? (
                <ShareLinkCard
                  title="MAAG monthly report link"
                  url={maagReportShareUrl}
                  description="Send this branch-scoped MAAG form to branch leaders for monthly district reporting."
                />
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="app-rise self-start p-6 sm:p-7" style={{ animationDelay: "60ms" }}>
        <CardHeader
          label="Branch profile"
          title="Manage branch details"
          description="Update the branch name, location, contact details and operating status."
        />

        {canEdit ? (
          <form action={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Branch name">
              <input name="name" defaultValue={branch.name} className="ui-input" />
            </Field>
            <Field label="Status">
              <input name="status" defaultValue={branch.status} className="ui-input" />
            </Field>

            {isGlobalRole(currentUserRole) ? (
              <Field label="National area">
                <select
                  name="oversightRegion"
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
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
                <input type="hidden" name="oversightRegion" value={defaultOversightRegion ?? branch.oversightRegion} />
                <input value={defaultOversightRegion || branch.oversightRegion} readOnly className={READ_ONLY_INPUT} />
              </Field>
            )}

            {isDistrictRole(currentUserRole) ? (
              <Field label="District">
                <input type="hidden" name="district" value={defaultDistrict ?? branch.district} />
                <input value={defaultDistrict || branch.district} readOnly className={READ_ONLY_INPUT} />
              </Field>
            ) : (
              <Field label="District">
                <select
                  name="district"
                  defaultValue={branch.district}
                  disabled={availableDistricts.length === 0}
                  className="ui-input"
                >
                  {availableDistricts.length === 0 ? <option value="">Create district first</option> : null}
                  {availableDistricts.map((district) => (
                    <option key={district._id} value={district.name}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="City">
              <input name="city" defaultValue={branch.city} className="ui-input" />
            </Field>
            <Field label="State">
              <input name="state" defaultValue={branch.state} className="ui-input" />
            </Field>
            <Field label="Country">
              <input name="country" defaultValue={branch.country} className="ui-input" />
            </Field>
            <Field label="Service times">
              <input name="serviceTimes" defaultValue={branch.serviceTimes} className="ui-input" />
            </Field>
            <Field label="Contact info" className="md:col-span-2">
              <input name="contactInfo" defaultValue={branch.contactInfo} className="ui-input" />
            </Field>
            <Field label="Address" className="md:col-span-2">
              <input name="address" defaultValue={branch.address} className="ui-input" />
            </Field>
            <p className="text-[13px] leading-[1.6] text-[#8a8780] md:col-span-2">
              National areas and districts are managed from{" "}
              <a href="/structure" className="font-medium text-[#111111] underline underline-offset-2">
                Structure
              </a>
              .
            </p>
            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={loading || (!isDistrictRole(currentUserRole) && availableDistricts.length === 0)}
              >
                {loading ? "Saving..." : "Update branch"}
              </Button>
            </div>
            {status ? (
              <p role="status" className="text-[14px] text-[#55534e] md:col-span-2">
                {status}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="mt-6 rounded-xl bg-[#f6f5f1] px-4 py-3 text-[14px] leading-[1.6] text-[#55534e]">
            You can review staffing, regional placement, member load and guest movement here. Structural edits to this branch are handled by admins for this scope.
          </p>
        )}
      </Card>
    </div>
  );
}

const READ_ONLY_INPUT = "ui-input bg-[#f6f5f1] text-[#6b6b6b]";

function TeamBlock({
  title,
  users,
  empty,
}: {
  title: string;
  users: BranchOverview["admins"];
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f6f5f1] p-4">
      <p className="text-[12px] font-medium text-[#6b6b6b]">{title}</p>
      <div className="mt-3">
        <TeamPills users={users} emptyLabel={empty} />
      </div>
    </div>
  );
}
