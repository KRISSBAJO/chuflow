import type { GuestCustomAnswer } from "@/lib/guest-fields";

export type YouthGroup = {
  _id: string;
  branchId: string;
  program: string;
  name: string;
  minAge: number;
  maxAge: number;
  meetingDay: number;
  eventDate?: string;
  campEndDate?: string;
  registrationDeadline?: string;
  venue?: string;
  capacity?: number;
  guardianUnderAge: number;
  leaderId?: string;
  clearanceUntil?: string;
};
export type YouthOverview = {
  canManage: boolean;
  canManageEvents: boolean;
  pilotAvailable: boolean;
  branches: { _id: string; name: string }[];
  groups: (Pick<YouthGroup, "_id" | "program" | "name" | "eventDate" | "campEndDate" | "venue" | "capacity"> & { branchName: string; canOpen: boolean; active: number; pending: number; sessions: number; visits: number })[];
};
export type YouthPerson = {
  _id: string;
  firstName: string;
  lastName: string;
  state: "pending" | "active";
  needsGuardian: boolean;
  birthDate?: string;
  guardianName?: string;
  contact?: string;
  welcomedAt?: string;
  consentAt?: string;
  consentVersion?: number;
  customAnswers?: GuestCustomAnswer[];
  campFollowUp?: YouthEventFollowUp;
};
export type YouthEventFollowUp = {
  ownerId: string; dueDate: string; date: string; reason: "welcome" | "missed" | "invite";
  outcome: "open" | "connected" | "no_response" | "declined"; revision: number;
};
export type YouthDetail = {
  group: YouthGroup;
  manager: boolean;
  date: string;
  people: YouthPerson[];
  leaders: { _id: string; firstName: string; lastName: string }[];
  destinations: Pick<YouthGroup, "_id" | "name" | "minAge" | "maxAge" | "guardianUnderAge">[];
  canRecord: boolean;
  registrationAvailable?: boolean;
  registrationToken: string | null;
  present: string[];
  followUpOwners?: YouthDetail["leaders"];
  attendanceRecorded?: boolean;
  recentSessions: { date: string; count: number }[];
};
