"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, Badge, EmptyState, statusTone } from "@/components/ui/ui";
import { useRoleLabel } from "@/i18n/labels";
import { detailHref } from "@/lib/workspace-navigation";
import type {
  UserSummary,
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";
export function UserManagementList({
  users,
  branches,
}: {
  users: UserSummary[];
  branches: BranchSummary[];
  currentUserRole: string;
  currentUserId?: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
  const params = useSearchParams();
  const tw = useTranslations("workspace");
  const t = useTranslations("org.userList");
  const roleLabel = useRoleLabel();
  if (!users.length)
    return (
      <EmptyState icon="users" title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  return (
    <div className="space-y-2">
      {users.map((user) => {
        const name = `${user.firstName} ${user.lastName}`;
        return (
          <Link
            id={`record-${user._id}`}
            key={user._id}
            href={detailHref(
              "/users",
              user._id,
              Object.fromEntries(params.entries()),
            )}
            className="flex scroll-mt-24 items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-4 hover:border-orange-300"
          >
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{name}</p>
              <p className="truncate text-xs text-[#6b6b6b]">
                {user.email} ·{" "}
                {branches.find((b) => b._id === user.branchId)?.name ||
                  user.district ||
                  user.oversightRegion ||
                  t("overallOversight")}
              </p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Badge>{roleLabel(user.role)}</Badge>
              <Badge tone={statusTone(user.isActive ? "active" : "inactive")}>
                {user.isActive ? tw("active") : tw("inactive")}
              </Badge>
            </div>
            <span className="text-sm text-orange-700">{tw("open")} ↗</span>
          </Link>
        );
      })}
    </div>
  );
}
