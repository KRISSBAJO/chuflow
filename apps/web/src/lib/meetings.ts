export type MeetingPerson = {
  _id: string;
  email?: string;
  firstName: string;
  lastName: string;
  branchId?: string;
};
export type MeetingGroup = {
  _id: string;
  branchId: string | { _id: string; name: string };
  name: string;
  serviceUnitId?: string;
  enabled: boolean;
  minutesRequired: boolean;
  minutesDueHours: number;
  submitterUserIds: string[];
  reviewerUserIds: string[];
  revision: number;
};
export type MeetingOptions = {
  branches: { _id: string; name: string }[];
  users: MeetingPerson[];
  serviceUnits: { _id: string; name: string; branchId: string }[];
  groups: MeetingGroup[];
  isAdmin: boolean;
  userId: string;
};
export type MeetingAction = {
  id: string;
  title: string;
  ownerUserId: string;
  dueAt?: string;
  status: "open" | "done";
};
export type Meeting = {
  audienceMode?: string;
  audienceServiceUnitIds?: string[];
  additionalMemberIds?: string[];
  invitationsRequested?: boolean;
  invitationSummary?: {
    requested: boolean;
    prepared: boolean;
    uniqueEmails: number;
    missingEmail: number;
    counts: Record<string, number>;
  };
  _id: string;
  branchId: string | { _id: string; name: string };
  groupId: string | { _id: string; name: string };
  title: string;
  agenda: string;
  startsAt: string;
  endsAt: string;
  location: string;
  joinUrl: string;
  organizerUserId: string;
  attendeeUserIds: string[];
  presentUserIds: string[];
  attendeeMemberIds: string[];
  presentMemberIds: string[];
  status: string;
  minutesRequired: boolean;
  minutesDueAt: string;
  minutesBody: string;
  minutesLinks: string[];
  minutesStatus: string;
  reviewComment: string;
  revision: number;
  minutesOverdue: boolean;
  actions: MeetingAction[];
  group: MeetingGroup;
  attendeeMembers: MeetingPerson[];
  attendeeUsers: MeetingPerson[];
  canManage: boolean;
  canReview: boolean;
  files: { _id: string; name: string; size: number }[];
  minutesHistory: {
    revision: number;
    body: string;
    links: string[];
    status: string;
    by: string;
    at: string;
    comment?: string;
  }[];
};
export const referenceId = (value: string | { _id: string }) =>
  typeof value === "string" ? value : value._id;
export const meetingName = (person?: MeetingPerson) =>
  person ? `${person.firstName} ${person.lastName}` : "User unavailable";
