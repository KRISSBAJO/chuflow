import { ImportLink } from "@/components/import-link";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { MemberRoster } from "@/components/member-roster";
import { ExportMenu } from "@/components/export-menu";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import {
  DirectoryControls,
  DirectoryPagination,
} from "@/components/directory-controls";
import type { DirectoryParams } from "@/lib/directory";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ConvertGuestForm } from "@/components/convert-guest-form";
import { TemplateQrCard } from "@/components/template-qr-card";
import { Icon } from "@/components/app/icons";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  EmptyState,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { useMemberFormLabels } from "@/lib/member-form-options";
import { serverGet } from "@/lib/server-api";
import type {
  BranchSummary,
  ServiceUnitSummary,
  GuestListResponse,
  IntakeTemplate,
  MemberListItem,
} from "@/lib/types";

type MemberDirectory = {
  items: MemberListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    active: number;
    foundationPending: number;
    pendingConversion: number;
  };
};
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<DirectoryParams>;
}) {
  const user = await requireServerRole("/members");
  const t = await getTranslations("org.members");

  const params = await searchParams;
  const tw = await getTranslations("workspace");
  const query = new URLSearchParams();
  for (const key of [
    "search",
    "branchId",
    "status",
    "serviceUnitId",
    "foundation",
    "holySpirit",
    "sort",
    "page",
    "pageSize",
  ])
    if (params[key]) query.set(key, params[key]);
  const [directory, guestList, templates, branches, units] = await Promise.all([
    serverGet<MemberDirectory>(`/members/directory?${query}`),
    serverGet<GuestListResponse>("/guests?limit=1").catch(() => ({
      items: [],
      pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1 },
      summary: { todayCount: 0, completionRate: 0, assignedFollowUpCount: 0 },
    })),
    serverGet<IntakeTemplate[]>("/intake-templates").catch(() => []),
    serverGet<BranchSummary[]>("/branches"),
    serverGet<ServiceUnitSummary[]>("/service-units"),
  ]);
  const guests = guestList.items;

  const members = directory.items;
  const activeMembers = directory.summary.active;
  const pendingConversion = directory.summary.pendingConversion;
  const foundationClass = directory.summary.foundationPending;
  const activeMemberTemplate =
    templates.find(
      (template) =>
        template.kind === "member" &&
        template.isActive &&
        template.branchId === user.branchId,
    ) ||
    templates.find(
      (template) =>
        template.kind === "member" && template.isActive && !template.branchId,
    );

  return (
    <Shell>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <><ImportLink kind="members" /><Link href="/members/new" className={buttonClass("primary", "md")}>
            <Icon name="plus" className="h-4 w-4" />
            {t("addMember")}
          </Link></>
        }
      />
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("activeMembers")}
          value={String(activeMembers)}
          delta={t("activeMembersCaption")}
          tone="cool"
        />
        <MetricCard
          label={t("pendingConversion")}
          value={String(pendingConversion)}
          delta={t("pendingConversionCaption")}
          tone="warm"
        />
        <MetricCard
          label={t("foundationClass")}
          value={String(foundationClass)}
          delta={t("foundationClassCaption")}
          tone="cool"
        />
      </section>
      <WorkspaceTabs
        defaultTab="members"
        tabs={[
          {
            id: "members",
            label: tw("members"),
            count: directory.pagination.total,
            content: (
              <>
                <div className="flex justify-end">
                  <ExportMenu resource="members" />
                </div>
                <Card className="app-rise min-w-0 p-6 sm:p-7">
                  <CardHeader
                    label={t("rosterLabel")}
                    title={t("rosterTitle")}
                    description={t("rosterDescription")}
                    action={
                      <Badge>
                        {t("matching", { count: directory.pagination.total })}
                      </Badge>
                    }
                  />
                  <MemberDirectoryControls
                    params={params}
                    branches={branches}
                    units={units}
                  />
                  <div className="mt-6">
                    {members.length > 0 ? (
                      <MemberRoster members={members} params={params} />
                    ) : (
                      <EmptyState icon="members" title={t("emptyTitle")}>
                        {t("emptyBody")}
                      </EmptyState>
                    )}
                  </div>
                  <DirectoryPagination
                    path="/members"
                    params={params}
                    {...directory.pagination}
                  />
                </Card>
              </>
            ),
          },
          {
            id: "conversion",
            label: tw("conversion"),
            count: pendingConversion,
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                {" "}
                <Card className="p-6 sm:p-7">
                  <CardHeader
                    label={t("conversionLabel")}
                    title={t("conversionTitle")}
                    description={t("conversionDescription")}
                  />
                  <div className="mt-5">
                    <ConvertGuestForm
                      guests={guests.filter(
                        (guest) => guest.visitStatus !== "member",
                      )}
                    />
                  </div>
                </Card>
                <Card className="p-6 sm:p-7">
                  <CardHeader
                    label={t("funnelLabel")}
                    title={t("funnelTitle")}
                  />
                  <dl className="mt-5 divide-y divide-black/[0.05]">
                    {[
                      [t("totalGuests"), String(guestList.pagination.total)],
                      [t("readyForConversion"), String(pendingConversion)],
                      [t("convertedMembers"), String(directory.summary.total)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between py-3"
                      >
                        <dt className="text-[14px] text-[#55534e]">{label}</dt>
                        <dd className="lp-heading text-[20px] tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </div>
            ),
          },
          {
            id: "links",
            label: tw("links"),
            content: (
              <div className="max-w-2xl">
                {" "}
                <Card className="p-6 sm:p-7">
                  <CardHeader
                    label={t("intakeLabel")}
                    title={t("intakeTitle")}
                    description={t("intakeDescription")}
                  />
                  <div className="mt-5">
                    {activeMemberTemplate ? (
                      <TemplateQrCard
                        allowSpanish
                        url={
                          activeMemberTemplate.shareUrl ||
                          `http://localhost:3001/intake/${activeMemberTemplate.slug}`
                        }
                        title={t("shareLinkTitle", {
                          name: activeMemberTemplate.name,
                        })}
                      />
                    ) : (
                      <EmptyState icon="templates" title={t("noFormTitle")}>
                        {t("noFormBody")}
                      </EmptyState>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </Shell>
  );
}

function MemberDirectoryControls({
  params,
  branches,
  units,
}: {
  params: DirectoryParams;
  branches: BranchSummary[];
  units: ServiceUnitSummary[];
}) {
  const t = useTranslations("org.members");
  const tCommon = useTranslations("common");
  const labels = useMemberFormLabels();
  return (
    <DirectoryControls
      path="/members"
      alwaysSearch
      params={params}
      placeholder={t("searchPlaceholder")}
      filters={[
        {
          key: "branchId",
          label: tCommon("branch"),
          options: branches.map((branch) => ({
            value: branch._id,
            label: branch.name,
          })),
        },
        {
          key: "status",
          label: t("membershipStatus"),
          options: ["active", "inactive", "new_member", "worker"].map(
            (value) => ({ value, label: labels.membershipStatusOption(value) }),
          ),
        },
        {
          key: "serviceUnitId",
          label: t("serviceUnit"),
          options: units.map((unit) => ({
            value: unit._id,
            label: unit.name,
          })),
        },
        {
          key: "foundation",
          label: t("foundationClass"),
          options: [
            { value: "yes", label: t("completed") },
            { value: "pending", label: t("notCompleted") },
          ],
        },
        {
          key: "holySpirit",
          label: t("holySpiritBaptism"),
          options: [
            { value: "yes", label: tCommon("yes") },
            { value: "pending", label: t("notRecordedAsYes") },
          ],
        },
      ]}
    />
  );
}
