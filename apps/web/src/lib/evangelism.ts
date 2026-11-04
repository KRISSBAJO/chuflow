export const OUTREACH_STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["prayed_with", "Prayed with"],
  ["invited", "Invited"],
  ["visited", "Visited church"],
  ["discipleship", "Discipleship"],
  ["closed", "Closed"],
  ["do_not_contact", "Do not contact"],
] as const;
export const OUTREACH_METHODS = [
  ["phone_call", "Phone call"],
  ["text_message", "Text message"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["in_person", "In person"],
] as const;
export const OUTREACH_INTERESTS = [
  ["prayer", "Prayer"],
  ["learn_about_faith", "Learning about faith"],
  ["church_visit", "Visiting church"],
  ["pastoral_call", "Speaking with a pastor"],
  ["stay_connected", "Staying connected"],
] as const;
export type OutreachPerson = {
  _id: string;
  firstName: string;
  lastName: string;
};
export type OutreachLink = {
  _id: string;
  name: string;
  token: string;
  kind: "personal" | "branch";
  isActive: boolean;
  contactCount: number;
  branchId: { _id: string; name: string };
  ownerId?: OutreachPerson;
};
export type OutreachContact = {
  guestId?: {
    _id: string;
    firstName: string;
    lastName: string;
    convertedToMember?: boolean;
  };
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  city?: string;
  prayerRequest?: string;
  preferredContactMethod: string;
  preferredContactTime?: string;
  interest?: string;
  consentToContact: boolean;
  consentRecordedAt: string;
  stage: string;
  nextActionDate?: string;
  isOverdue?: boolean;
  createdAt: string;
  branchId: { _id: string; name: string };
  assignedTo?: OutreachPerson;
  reachedBy?: OutreachPerson;
  linkId?: { _id: string; name: string; kind: string };
  activities: {
    note: string;
    stage: string;
    contactMethod: string;
    recordedBy?: OutreachPerson;
    assignedTo?: OutreachPerson;
    nextActionDate?: string;
    createdAt: string;
  }[];
};
export type OutreachList = {
  items: OutreachContact[];
  total: number;
  page: number;
  totalPages: number;
  summary: { all: number; fresh: number; overdue: number; unassigned: number };
  stages: Record<string, number>;
};
export function outreachLabel(value: string) {
  if (value === "administrative") return "Administrative note";
  if (value === "registration") return "Contact captured";
  return (
    [...OUTREACH_STAGES, ...OUTREACH_METHODS, ...OUTREACH_INTERESTS].find(
      ([key]) => key === value,
    )?.[1] ?? value
  );
}
export function outreachName(person?: OutreachPerson) {
  return person ? `${person.firstName} ${person.lastName}` : "Unassigned";
}
