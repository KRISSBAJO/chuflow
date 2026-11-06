export type CarePerson = {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
};
export type CareOptions = {
  branches: { _id: string; name: string }[];
  isAdmin: boolean;
  userId: string;
};
export type CareTask = {
  _id: string;
  title: string;
  kind: string;
  status: string;
  dueAt: string;
  attempts: number;
  escalated: boolean;
  evidence?: string;
  outcome?: string;
  assignedTo?: string;
};
export type CareRecord = {
  _id: string;
  branchId: string | { _id: string; name: string };
  firstName: string;
  lastName: string;
  personType: string;
  journey: string;
  stage: string;
  email?: string;
  phone?: string;
  ownerId?: string | CarePerson;
  backupId?: string;
  handover?: { to: string; from: string; status: string; requestedAt: string };
  stopContact: boolean;
  emailAllowed: boolean;
  language: string;
  pausedUntil?: string;
  absenceExplanation?: string;
  lastContactAt?: string;
  lastAttendanceAt?: string;
  milestones: string[];
  revision: number;
  automationEnrolledAt?: string;
  canManage: boolean;
  canAccept: boolean;
  isAdmin: boolean;
  summary: string;
  people: CarePerson[];
  units: { _id: string; name: string }[];
  tasks: CareTask[];
  events: {
    _id: string;
    kind: string;
    text: string;
    visibility: string;
    createdAt: string;
    actorId?: CarePerson;
    data?: { method?: string; outcome?: string; nextActionAt?: string };
  }[];
  eventTotal: number;
  eventPage: number;
  jobs: {
    _id: string;
    kind: string;
    status: string;
    dueAt: string;
    result: string;
  }[];
  nextTask?: CareTask;
  openTasks?: number;
  guestId?: string;
  memberId?: string;
  outreachId?: string;
};
export type CareOverview = {
  cohorts: {
    _id: string;
    guests: number;
    contacted24h: number;
    returned30: number;
    members: number;
  }[];
  total: number;
  unassigned: number;
  overdue: number;
  escalated: number;
  retention: number;
  connected: number;
  contacts: number;
  stages: { _id: string; count: number }[];
  plans: { branchId: string; enabled: boolean; attendanceReliable: boolean }[];
  briefing: string[];
  cohort: {
    guests: number;
    contacted24h: number;
    returned: number;
    becameMembers: number;
  };
};
export type CarePlan = {
  capabilities?: { emailConfigured: boolean; publicOrigin: string };
  retentionEmailEnabled: boolean;
  retentionSubject: string;
  retentionMessage: string;
  retentionSubjectEs: string;
  retentionMessageEs: string;
  branchId: string;
  enabled: boolean;
  teamIds: string[];
  leaderId?: string;
  unavailableUntil: Record<string, string>;
  firstContactHours: number;
  retryHours: number;
  maxAttempts: number;
  escalationHours: number;
  capacity: number;
  emailEnabled: boolean;
  maxAutomatedMessages: number;
  timeZone: string;
  quietStart: number;
  quietEnd: number;
  subject: string;
  message: string;
  subjectEs: string;
  messageEs: string;
  attendanceReliable: boolean;
  coverageFrom?: string;
  absenceDays: number;
  minAttendanceRecords: number;
  weeklyDigest: boolean;
  revision: number;
  people: CarePerson[];
};
export const careId = (value: string | { _id: string }) =>
  typeof value === "string" ? value : value._id;
export const careLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());

/** Care values that have a translated label under `people.care.labels`; others fall back to `careLabel`. */
export const CARE_LABEL_VALUES = [
  "guest",
  "member",
  "outreach",
  "guest_welcome",
  "member_connection",
  "new",
  "connecting",
  "connected",
  "paused",
  "closed",
  "open",
  "done",
  "cancelled",
  "today",
  "mine",
  "unassigned",
  "overdue",
  "escalated",
  "all",
  "timeline",
  "tasks",
  "connection",
  "preferences",
  "contact",
  "contacted",
  "no_answer",
  "callback_requested",
  "needs_help",
  "declined",
  "resolved",
  "phone",
  "email",
  "whatsapp",
  "text",
  "in_person",
  "administrative",
  "note",
  "handover",
  "assign",
  "pause",
  "resume",
  "journey",
  "accept",
  "accepted",
  "pending",
  "decline",
  "enroll",
  "task",
  "complete",
  "retry_messages",
  "plan_change",
  "pastoral_request",
  "member_checkin",
  "checkin",
  "attendance_recorded",
  "return_visit_recorded",
  "membership_recorded",
  "service_group_joined",
  "foundation_recorded",
  "bcc_recorded",
  "lcc_recorded",
  "lcd_recorded",
  "care_email",
  "staff_digest",
  "absence_check",
  "first_contact",
  "callback",
  "escalation",
  "care_action",
  "group_introduction",
  "unsubscribe",
  "queued",
  "sending",
  "sent",
  "failed",
  "dispatched",
  "logged",
  "uncertain",
  "retention",
  "retention_signal",
  "staff_escalation",
] as const;
export type CareLabelValue = (typeof CARE_LABEL_VALUES)[number];
export const isCareLabelValue = (value: string): value is CareLabelValue =>
  (CARE_LABEL_VALUES as readonly string[]).includes(value);
