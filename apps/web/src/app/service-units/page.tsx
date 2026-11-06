import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import { browseDirectory, type DirectoryParams } from "@/lib/directory";
import { Icon, type IconName } from "@/components/app/icons";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ServiceUnitCreateModalButton } from "@/components/service-unit-create-modal-button";
import { ServiceUnitManagementList } from "@/components/service-unit-management-list";
import { Shell } from "@/components/shell";
import { Badge, Card, CardHeader, buttonClass } from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  MemberListItem,
  ServiceUnitSummary,
} from "@/lib/types";

const OPERATIONS_NOTES: { icon: IconName; key: "noteMembers" | "noteUsers" | "noteSignups" }[] = [
  { icon: "members", key: "noteMembers" },
  { icon: "users", key: "noteUsers" },
  { icon: "arrowRight", key: "noteSignups" },
];

export default async function ServiceUnitsPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const params = await searchParams;
  const user = await requireServerRole("/service-units");
  const t = await getTranslations("org.serviceUnits");
  const tCommon = await getTranslations("common");
  const tStatuses = await getTranslations("statuses");

  const [serviceUnits, branches, members] = await Promise.all([
    serverGet<ServiceUnitSummary[]>("/service-units"),
    serverGet<BranchSummary[]>("/branches").catch(() => []),
    serverGet<MemberListItem[]>("/members"),
  ]);

  const activeUnits = serviceUnits.filter((unit) => unit.isActive).length;
  const staffedUnits = serviceUnits.filter(
    (unit) => unit.leaderMemberId?._id && unit.secretaryMemberId?._id,
  ).length;
  const assignedMembers = serviceUnits.reduce(
    (total, unit) => total + (unit.memberCount ?? 0),
    0,
  );

  const directory = browseDirectory(
    serviceUnits,
    params,
    (unit) =>
      [
        unit.name,
        unit.meetingDay,
        unit.prayerDay,
        unit.notes,
        unit.leaderMemberId?.firstName,
        unit.leaderMemberId?.lastName,
      ].join(" "),
    (unit) => unit.name,
    {
      status: (unit) => (unit.isActive ? "active" : "inactive"),
      branchId: (unit) =>
        typeof unit.branchId === "string"
          ? unit.branchId
          : unit.branchId?._id || "",
    },
  );
  const directoryFilters = [
    {
      key: "status",
      label: tCommon("status"),
      options: [
        { value: "active", label: tStatuses("active") },
        { value: "inactive", label: tStatuses("inactive") },
      ],
    },
    {
      key: "branchId",
      label: tCommon("branch"),
      options: branches.map((branch) => ({
        value: branch._id,
        label: branch.name,
      })),
    },
  ];
  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/meetings/groups" className={buttonClass("secondary")}>
              {t("meetingRequirements")}
            </Link>
            <ServiceUnitCreateModalButton
              branches={branches}
              members={members}
              defaultBranchId={user.branchId}
              currentUserRole={user.role}
            />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("units")}
          value={String(serviceUnits.length)}
          delta={t("unitsCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("activeUnits")}
          value={String(activeUnits)}
          delta={t("inactiveCount", { count: Math.max(serviceUnits.length - activeUnits, 0) })}
          tone="warm"
        />
        <MetricCard
          label={t("fullyStaffed")}
          value={String(staffedUnits)}
          delta={t("fullyStaffedCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("groupMemberships")}
          value={String(assignedMembers)}
          delta={t("groupMembershipsCaption")}
          tone="warm"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)] xl:items-start">
        <Card className="app-rise p-6 sm:p-7">
          <CardHeader
            label={t("directoryLabel")}
            title={t("directoryTitle")}
            description={t("directoryDescription")}
            action={<Badge>{t("branchIsolated")}</Badge>}
          />
          <div className="mt-6">
            <DirectoryControls
              path="/service-units"
              params={params}
              filters={directoryFilters}
            />
            <ServiceUnitManagementList
              serviceUnits={directory.items}
              members={members}
              branches={branches}
              currentUserRole={user.role}
            />
            <DirectoryPagination
              path="/service-units"
              params={params}
              {...directory}
            />
          </div>
        </Card>

        <Card
          className="app-rise p-6 sm:p-7"
          style={{ animationDelay: "60ms" }}
        >
          <CardHeader label={t("howItWorks")} title={t("operations")} />
          <ul className="mt-5 space-y-3">
            {OPERATIONS_NOTES.map((note) => (
              <li
                key={note.key}
                className="flex gap-3 rounded-2xl bg-[#f6f5f1] p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#ea580c] shadow-[0_1px_2px_rgba(17,17,17,0.06)]">
                  <Icon name={note.icon} className="h-4 w-4" />
                </span>
                <p className="text-[14px] leading-[1.6] text-[#55534e]">
                  {t(note.key)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </Shell>
  );
}
