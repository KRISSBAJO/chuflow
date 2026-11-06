/* Pastoral care shapes, mirroring apps/web/src/lib/care.ts and the care API. */

export type CarePerson = { _id: string; firstName: string; lastName: string; email?: string };

export type CareOptions = { branches: { _id: string; name: string }[]; isAdmin: boolean; userId: string };

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

export type CareEvent = {
  _id: string;
  kind: string;
  text: string;
  visibility: string;
  createdAt: string;
  actorId?: CarePerson;
  data?: { method?: string; outcome?: string; nextActionAt?: string; stage?: string };
};

export type CareListItem = {
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
  stopContact: boolean;
  lastContactAt?: string;
  updatedAt?: string;
  nextTask?: CareTask;
  openTasks?: number;
};

export type CareRecord = CareListItem & {
  backupId?: string;
  handover?: { to: string; from: string; status: string; requestedAt: string };
  emailAllowed: boolean;
  language: string;
  pausedUntil?: string;
  absenceExplanation?: string;
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
  events: CareEvent[];
  eventTotal: number;
  eventPage: number;
  jobs: { _id: string; kind: string; status: string; dueAt: string; result: string }[];
  guestId?: string;
  memberId?: string;
  outreachId?: string;
};

export type CareListResponse = { items: CareListItem[]; total: number; page: number; totalPages: number };

export type CareOverview = {
  total: number;
  unassigned: number;
  overdue: number;
  escalated: number;
  retention: number;
  connected: number;
  contacts: number;
  briefing: string[];
};

export const CARE_VIEWS = ['today', 'mine', 'unassigned', 'overdue', 'escalated', 'retention', 'all'] as const;
export type CareView = (typeof CARE_VIEWS)[number];

export const CARE_STAGES = ['new', 'connecting', 'connected', 'paused', 'closed'] as const;
export const CARE_OUTCOMES = ['contacted', 'no_answer', 'callback_requested', 'needs_help', 'connected', 'declined', 'resolved'] as const;
export const CARE_METHODS = ['phone', 'whatsapp', 'text', 'email', 'in_person', 'administrative'] as const;

export function careId(value?: string | { _id: string } | null) {
  return !value ? '' : typeof value === 'string' ? value : value._id;
}

export function careOwner(value?: string | CarePerson | null): CarePerson | null {
  return value && typeof value === 'object' ? value : null;
}
