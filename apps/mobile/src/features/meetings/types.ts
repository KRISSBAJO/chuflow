/* Meeting API shapes, mirroring apps/web/src/lib/meetings.ts. */

export type MeetingRef = string | { _id: string; name: string };

export type MeetingPerson = { _id: string; firstName: string; lastName: string; email?: string; branchId?: string };

export type MeetingGroup = {
  _id: string;
  branchId: MeetingRef;
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

export type MeetingAction = { id: string; title: string; ownerUserId: string; dueAt?: string; status: 'open' | 'done' };

export type MeetingStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type AudienceMode = 'individuals' | 'service_groups' | 'church';

export type MeetingListItem = {
  _id: string;
  branchId: MeetingRef;
  groupId: MeetingRef;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  joinUrl: string;
  status: MeetingStatus | string;
  minutesRequired: boolean;
  minutesStatus: string;
  minutesOverdue?: boolean;
  attendeeUserIds: string[];
  attendeeMemberIds?: string[];
  presentUserIds: string[];
  presentMemberIds?: string[];
  actions: MeetingAction[];
};

export type Meeting = MeetingListItem & {
  customAnswers?: { key: string; label: string; value: string | number }[];
  agenda: string;
  organizerUserId: string;
  audienceMode?: AudienceMode;
  audienceServiceUnitIds?: string[];
  invitationsRequested?: boolean;
  invitationSummary?: { requested: boolean; prepared: boolean; uniqueEmails: number; missingEmail: number; counts: Record<string, number> };
  minutesDueAt: string;
  minutesBody: string;
  minutesLinks: string[];
  reviewComment: string;
  revision: number;
  group: MeetingGroup;
  attendeeMembers: MeetingPerson[];
  attendeeUsers: MeetingPerson[];
  canManage: boolean;
  canReview: boolean;
  files: { _id: string; name: string; size: number }[];
};

export type MeetingListResponse = { items: MeetingListItem[]; total: number; page: number; limit: number; totalPages: number };

export type ParticipantsResponse = { items: MeetingPerson[]; total: number; limit: number };

export const refId = (value?: MeetingRef | null) => (!value ? '' : typeof value === 'string' ? value : value._id);
export const refName = (value?: MeetingRef | null) => (!value || typeof value === 'string' ? '' : value.name);
