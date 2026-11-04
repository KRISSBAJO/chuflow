import Link from "next/link";
import { buttonClass } from "@/components/ui/ui";
import type {
  BranchSummary,
  DistrictOption,
  OversightRegionOption,
} from "@/lib/types";

export function UserCreateModalButton(props: {
  branches: BranchSummary[];
  currentUserRole: string;
  defaultBranchId?: string;
  defaultOversightRegion?: string;
  defaultDistrict?: string;
  oversightRegions: OversightRegionOption[];
  districts: DistrictOption[];
}) {
void props;
return <Link href="/users/new" className={buttonClass("primary")}>{"Create user"}</Link>;
}
