import Link from "next/link";
import { buttonClass } from "@/components/ui/ui";
import type { BranchSummary, ServiceTypeSummary, UserSummary } from "@/lib/types";

export function GuestCreateModalButton(props: {
  branches: BranchSummary[];
  users: UserSummary[];
  serviceTypes: ServiceTypeSummary[];
  defaultBranchId?: string;
  label?: string;
  className?: string;
}) {
return <Link href={props.defaultBranchId ? `/guests/new?branchId=${encodeURIComponent(props.defaultBranchId)}` : "/guests/new"} className={props.className ?? buttonClass("primary")}>{props.label ?? "New guest"}</Link>;
}
