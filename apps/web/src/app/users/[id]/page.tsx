import { canDelegatePermissions } from "@/lib/capabilities";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { UserAccountEditor } from "@/components/user-account-editor";
import { AuditLogFeed } from "@/components/audit-log-feed";
import {
  Badge,
  Card,
  CardHeader,
  buttonClass,
  Pagination,
} from "@/components/ui/ui";
import { requireServerRole } from "@/lib/auth";
import { serverGet } from "@/lib/server-api";
import { formatRoleLabel } from "@/lib/permissions";
import { safeReturnTo } from "@/lib/workspace-navigation";
import type {
  AuditLogListResponse,
  BranchSummary,
  DistrictOption,
  MemberListItem,
  OversightRegionOption,
  UserSummary,
} from "@/lib/types";

type AccessDetails = {
  assignments: { id: string; name: string; kind: string }[];
  churches: BranchSummary[];
};
export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const viewer = await requireServerRole("/users");
  const tp = await getTranslations("permissionManager");
  const { id } = await params;
  const query = await searchParams;
  const [user, branches, regions, districts, access, audit, t, format] =
    await Promise.all([
      serverGet<UserSummary>(`/users/${id}`),
      serverGet<BranchSummary[]>("/branches"),
      serverGet<OversightRegionOption[]>("/oversight-regions").catch(() => []),
      serverGet<DistrictOption[]>("/districts").catch(() => []),
      serverGet<AccessDetails>(`/users/${id}/access`),
      serverGet<AuditLogListResponse>(
        `/audit-logs?entityType=user&entityId=${encodeURIComponent(id)}&limit=25&page=${Math.max(1, Number(query.auditPage) || 1)}`,
      ).catch(() => null),
      getTranslations("workspace"),
      getFormatter(),
    ]);
  const matches = await serverGet<{ items: MemberListItem[] }>(
    `/members/directory?search=${encodeURIComponent(user.email)}&pageSize=25`,
  ).catch(() => ({ items: [] }));
  const exactMembers = matches.items.filter(
    (m) =>
      m.email?.toLowerCase() === user.email.toLowerCase() &&
      m.firstName.toLowerCase() === user.firstName.toLowerCase() &&
      m.lastName.toLowerCase() === user.lastName.toLowerCase(),
  );
  const member = exactMembers.length === 1 ? exactMembers[0] : undefined;
  const back = safeReturnTo(query.returnTo, "/users");
  const href = (tab: string, editing = false) =>
    `/users/${id}?${new URLSearchParams({ tab, returnTo: back, ...(editing ? { edit: "1" } : {}) })}`;
  const edit = (section: string) => (
    <Link
      href={href(section, true)}
      scroll={false}
      className={buttonClass("secondary", "sm")}
    >
      {t("edit")}
    </Link>
  );
  const editor = (section: "profile" | "access" | "security") =>
    query.tab === section && query.edit === "1" ? (
      <UserAccountEditor
        users={[user]}
        branches={branches}
        currentUserRole={viewer.role}
        currentUserId={viewer.id || viewer._id}
        defaultBranchId={viewer.branchId}
        defaultOversightRegion={viewer.oversightRegion}
        defaultDistrict={viewer.district}
        oversightRegions={regions}
        districts={districts}
        section={section}
        returnHref={href(section)}
      />
    ) : null;
  const branch = branches.find((b) => b._id === user.branchId);
  const role = formatRoleLabel(user.role);
  const profile = (
    <Card className="p-6">
      <CardHeader title={t("userProfile")} action={edit("profile")} />
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        {[
          [t("name"), `${user.firstName} ${user.lastName}`],
          [t("email"), user.email],
          [t("localChurch"), branch?.name || "—"],
          [t("role"), role],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[#8a8780]">{label}</dt>
            <dd className="mt-1 break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-black/5 pt-4">
        <p className="text-xs text-[#8a8780]">{t("matchingMember")}</p>
        {member ? (
          <Link
            href={`/members/${member._id}`}
            className="text-sm text-orange-700"
          >
            {member.firstName} {member.lastName} ↗
          </Link>
        ) : (
          <p className="mt-1 text-sm">{t("noLinkedMember")}</p>
        )}
      </div>
    </Card>
  );
  const oversight = (
    <Card className="p-6">
      <CardHeader title={t("appointments")} />
      <div className="mt-5 space-y-3">
        {access.assignments.length ? (
          access.assignments.map((a) => (
            <div key={a.id} className="rounded-xl bg-white p-4">
              <Badge tone="flame">{a.kind}</Badge>
              <p className="mt-2 font-medium">{a.name}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#6b6b6b]">{t("noAppointments")}</p>
        )}
      </div>
    </Card>
  );
  return (
    <Shell>
      <Link
        href={back}
        className="text-sm text-[#6b6b6b] hover:text-orange-700"
      >
        ← {t("backUsers")}
      </Link>
      <PageHeader
        eyebrow={role}
        title={`${user.firstName} ${user.lastName}`}
        description={
          branch?.name || user.district || user.oversightRegion || t("scope")
        }
        action={
          <Badge tone={user.isActive ? "success" : "neutral"}>
            {user.isActive ? t("active") : t("inactive")}
          </Badge>
        }
      />
      <WorkspaceTabs
        defaultTab="overview"
        tabs={[
          {
            id: "overview",
            label: t("overview"),
            content: (
              <div className="grid gap-5 xl:grid-cols-2">
                {profile}
                {oversight}
              </div>
            ),
          },
          {
            id: "profile",
            label: t("userProfile"),
            content: editor("profile") || profile,
          },
          {
            id: "access",
            label: t("access"),
            content: editor("access") || (
              <>
                <div className="flex justify-end">{edit("access")}</div>
                {oversight}
                {canDelegatePermissions(viewer.role) && <Card className="p-6"><CardHeader title={tp("permissionCard")} description={tp("unchanged")} action={<Link href={`/permissions?userId=${id}`} className={buttonClass("secondary")}>{tp("manage")}</Link>}/></Card>}
                <Card className="p-6">
                  <CardHeader title={t("coveredChurches")} />
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {access.churches.map((b) => (
                      <li
                        key={b._id}
                        className="rounded-xl bg-white p-3 text-sm"
                      >
                        {b.name}
                        <span className="block text-xs text-[#8a8780]">
                          {b.district}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            ),
          },
          {
            id: "security",
            label: t("security"),
            content: editor("security") || (
              <Card className="p-6">
                <CardHeader title={t("security")} action={edit("security")} />
                <p className="mt-5 text-sm">
                  {user.isActive ? t("enabled") : t("disabled")}
                </p>
                <p className="mt-3 text-sm text-[#6b6b6b]">
                  {t("lastSignIn")}:{" "}
                  {user.lastLoginAt
                    ? format.dateTime(new Date(user.lastLoginAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : t("never")}
                </p>
              </Card>
            ),
          },
          {
            id: "activity",
            label: t("activity"),
            content: (
              <Card className="p-6">
                <CardHeader title={t("changeHistory")} />
                <div className="mt-5">
                  {audit?.items.length ? (
                    <AuditLogFeed items={audit.items} />
                  ) : (
                    <p className="text-sm text-[#6b6b6b]">{t("noActivity")}</p>
                  )}
                </div>
                {audit && audit.pagination.totalPages > 1 && (
                  <Pagination
                    page={audit.pagination.page}
                    totalPages={audit.pagination.totalPages}
                    prevHref={
                      href("activity") +
                      `&auditPage=${Math.max(1, audit.pagination.page - 1)}`
                    }
                    nextHref={
                      href("activity") +
                      `&auditPage=${Math.min(audit.pagination.totalPages, audit.pagination.page + 1)}`
                    }
                  />
                )}
                {user.createdAt && (
                  <p className="mt-5 border-t border-black/5 pt-4 text-sm text-[#8a8780]">
                    {t("accountCreated")}:{" "}
                    {format.dateTime(new Date(user.createdAt), {
                      dateStyle: "medium",
                    })}
                  </p>
                )}
              </Card>
            ),
          },
        ]}
      />
    </Shell>
  );
}
