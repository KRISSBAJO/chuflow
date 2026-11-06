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
export type ChildProfile = {
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
};
export type Family = {
  _id: string;
  name: string;
  branchId: string;
  guardians: Guardian[];
  revision: number;
  children: ChildProfile[];
};
export type Room = {
  id: string;
  name: string;
  minMonths: number;
  maxMonths: number;
  capacity: number;
};
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
  authorizedPickup: {
    id: string;
    name: string;
    phone: string;
    relationship: string;
  }[];
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
  events: {
    action: string;
    actorId: string;
    at: string;
    note: string;
    childIds?: string[];
  }[];
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
export type ChildrenOptions = {
  branches: ChildrenBranch[];
  canManage: boolean;
  dedicated?: boolean;
};
export type ChildrenOverview = ChildrenOptions & {
  sessionPagination: { page: number; total: number; totalPages: number };
  branchId: string | null;
  families: { _id: string; name: string }[];
  sessions: {
    _id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: string;
    present: number;
    attended: number;
  }[];
  pagination: { page: number; total: number; totalPages: number };
};
