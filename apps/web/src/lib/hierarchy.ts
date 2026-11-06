export type HierarchyUnit = {
  _id: string;
  kind: "district" | "zone" | "area";
  name: string;
  parentId?: string;
  districtId: string;
  headquartersBranchId?: { _id: string; name: string } | null;
  pastorUserId?: { _id: string; firstName: string; lastName: string } | null;
  pastorVisibilityEnabled?: boolean;
  isActive: boolean;
  revision: number;
  churches: number;
  members: number;
  guests: number;
  partial: boolean;
};
export type HierarchyChurch = {
  _id: string;
  name: string;
  status?: string;
  zoneId?: string;
  areaId?: string;
  hierarchyRevision?: number;
};
export type HierarchyOverview = {
  districts: {
    _id: string;
    name: string;
    oversightRegion: string;
    isActive: boolean;
  }[];
  selectedDistrictId: string | null;
  units: HierarchyUnit[];
  branches: HierarchyChurch[];
  canManage: boolean;
  context: {
    homeBranchId?: string;
    hasOversight: boolean;
    assignments: { _id: string; name: string; kind: string }[];
  };
};
