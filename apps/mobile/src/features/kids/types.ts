/* Children's ministry API shapes, mirroring apps/web/src/lib/children.ts. */

export type ChildrenBranch = { _id: string; name: string };

export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  relationship: string;
  memberId?: string;
  canCheckIn: boolean;
};

export type RecordEvent = { action: string; actorId: string; actorName?: string; at: string; note: string; childIds?: string[] };

export type ChildProfile = {
  customAnswers?: { key: string; label: string; value: string | number }[];
  _id: string;
  familyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  guardianIds: string[];
  pickupGuardianIds: string[];
  careNotes: string;
  pickupNotes: string;
  photoConsent: boolean;
  photoUrl?: string;
  isMember: boolean;
  isActive: boolean;
  revision: number;
  events?: RecordEvent[];
};

export type Family = {
  customAnswers?: { key: string; label: string; value: string | number }[];
  _id: string;
  name: string;
  branchId: string;
  guardians: Guardian[];
  revision: number;
  children: ChildProfile[];
  events?: RecordEvent[];
};

export type Room = { id: string; name: string; minMonths: number; maxMonths: number; capacity: number };

export type ChildVisit = {
  id: string;
  childId: string;
  childName: string;
  familyId: string;
  roomId: string;
  status: string;
  checkedInAt: string;
  checkedOutAt?: string;
  broughtByName: string;
  collectedByName?: string;
  pickupDisplay: string;
  careNotes: string;
  pickupNotes: string;
  photoUrl?: string;
  authorizedPickup: { id: string; name: string; phone: string; relationship: string }[];
};

export type ChildSession = {
  _id: string;
  branchId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  revision: number;
  rooms: Room[];
  visits: ChildVisit[];
  events: RecordEvent[];
  canManage: boolean;
};

export type FamilySelection = {
  familyId: string;
  name: string;
  guardians: { id: string; name: string }[];
  children: {
    id: string;
    name: string;
    guardianIds: string[];
    checkedIn: boolean;
    rooms: { id: string; name: string; remaining: number }[];
  }[];
};

export type ReceiptData = {
  code: string;
  display: string;
  sessionName: string;
  children: { name: string; room: string; careAlert?: boolean }[];
};

export type LiveRoom = Room & { present: number };

export type Phase = 'upcoming' | 'live' | 'ending' | 'overdue' | 'closed';

export type LiveSession = {
  _id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  phase: 'upcoming' | 'live' | 'ending' | 'overdue';
  present: number;
  attended: number;
  collected: number;
  kiosks: number;
  rooms: LiveRoom[];
  recent: { action: string; at: string; count: number; kiosk: boolean }[];
};

export type AgeBucket = 'under3' | '3to5' | '6to9' | '10to12' | 'teens';

export type ChildrenStats = {
  children: number;
  families: number;
  visiting: number;
  newChildren: number;
  ageMix: Record<AgeBucket, number>;
  birthdays: { _id: string; name: string; familyId: string; date: string; turning: number }[];
  pendingRegistrations: number;
};

export type SessionTrendPoint = { _id: string; name: string; startsAt: string; status: string; attended: number; capacity: number };

export type LatestRooms = { name: string; startsAt: string; endsAt: string; rooms: Omit<Room, 'id'>[] } | null;

export type ChildrenOverview = {
  branches: ChildrenBranch[];
  canManage: boolean;
  dedicated?: boolean;
  sessionPagination: { page: number; total: number; totalPages: number };
  branchId: string | null;
  families: { _id: string; name: string; childCount: number; guardianCount: number }[];
  sessions: { _id: string; name: string; startsAt: string; endsAt: string; status: string; rooms: number; present: number; attended: number }[];
  live: LiveSession | null;
  trend: SessionTrendPoint[];
  stats: ChildrenStats | null;
  pagination: { page: number; total: number; totalPages: number };
};
