"use client";
import { useSession } from "./session-context";
import { hasPermission } from "@/lib/capabilities";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/ui";
import type { BranchSummary, MemberListItem } from "@/lib/types";

export function ServiceUnitCreateModalButton(props: {
  branches: BranchSummary[];
  members: MemberListItem[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
void props;
const t = useTranslations("org.serviceUnits");
const {user}=useSession();
if(user && !hasPermission(user,"service_units.create"))return null;
return <Link href="/service-units/new" className={buttonClass("primary")}>{t("createUnit")}</Link>;
}
