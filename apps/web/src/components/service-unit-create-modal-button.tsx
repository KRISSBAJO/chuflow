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
return <Link href="/service-units/new" className={buttonClass("primary")}>{t("createUnit")}</Link>;
}
