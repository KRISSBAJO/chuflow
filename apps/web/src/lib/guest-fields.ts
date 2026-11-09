export const ministryFormKinds = ["child", "family", "outreach", "service-unit", "meeting"] as const;
export type MinistryFormKind = (typeof ministryFormKinds)[number];

export type GuestField = {
  key: string;
  label: string;
  labelEs?: string;
  labelFr?: string;
  labelPt?: string;
  type: "text" | "textarea" | "number" | "select" | "email" | "tel";
  options: string[];
  required: boolean;
  public: boolean;
  staff: boolean;
  guestFieldKey?: string;
};

export type GuestStaffForm = {
  revision: number;
  branchId?: string | null;
  hiddenStaff: string[];
  fields: GuestField[];
};

export type GuestFormSettings = GuestStaffForm & {
  inheritedHiddenPublic?: string[];
  inheritedHiddenStaff?: string[];
  inheritedFields?: GuestField[];
  hiddenPublic: string[];
  defaultPublic: Array<{ key: string; label: string; labelEs?: string }>;
  defaultStaff: Array<"email" | "invitedBy" | "heardAboutChurch" | "prayerRequest" | "assignedFollowUpUserId" | "wantsPastoralCall" | "phone" | "title" | "familyDetails" | "dateJoinedChurch" | "formation" | "notes" | "payee" | "receiptUrl" | "city" | "preferredContactTime" | "agenda" | "location" | "joinUrl">;
  guestFields?: Pick<GuestField, "key" | "label" | "type">[];
};

export type GuestCustomAnswer = { key: string; label: string; value: string | number };
