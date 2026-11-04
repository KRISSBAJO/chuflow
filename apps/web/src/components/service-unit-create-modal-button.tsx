import Link from "next/link";
import { buttonClass } from "@/components/ui/ui";
import type { BranchSummary, MemberListItem } from "@/lib/types";

export function ServiceUnitCreateModalButton(props: {
  branches: BranchSummary[];
  members: MemberListItem[];
  defaultBranchId?: string;
  currentUserRole: string;
}) {
void props;
return <Link href="/service-units/new" className={buttonClass("primary")}>{"Create service unit"}</Link>;
}
