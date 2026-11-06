import type { BranchRef, Paginated } from '@/lib/types';

/* Member shapes, mirroring apps/web/src/lib/types.ts (MemberListItem) and the members API. */

export type ServiceUnitRef = { _id?: string; name?: string };

export type MemberListItem = {
  _id: string;
  title?: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  recordType?: 'adult' | 'child' | string;
  phone?: string;
  email?: string;
  dateJoinedChurch?: string;
  serviceUnitInterest?: string;
  serviceUnitIds?: ServiceUnitRef[];
  serviceUnitId?: ServiceUnitRef;
  branchId?: BranchRef;
  createdAt?: string;
};

export type MemberDetail = MemberListItem & {
  familyDetails?: string;
  believerFoundationClassStatus?: string;
  believerFoundationClassDate?: string;
  believerFoundationClassLocation?: string;
  bccStatus?: string;
  bccDate?: string;
  bccLocation?: string;
  lccStatus?: string;
  lccDate?: string;
  lccLocation?: string;
  lcdStatus?: string;
  lcdDate?: string;
  lcdLocation?: string;
  holySpiritBaptismStatus?: string;
  waterBaptismStatus?: string;
  guestId?: { _id?: string; firstName?: string; lastName?: string } | string | null;
  updatedAt?: string;
};

export type MemberDirectoryResponse = Paginated<MemberListItem> & {
  summary: { total: number; active: number; foundationPending: number; pendingConversion: number };
};

export type ServiceUnitSummary = {
  _id: string;
  name: string;
  isActive: boolean;
  meetingDay?: string;
  prayerDay?: string;
  branchId?: BranchRef | string;
};

export const MEMBERSHIP_STATUSES = ['active', 'new_member', 'worker', 'inactive'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBER_TITLES = ['bro', 'sister', 'pastor', 'resident_pastor', 'associate_pastor', 'deacon', 'deaconess', 'apostle', 'other'] as const;

/** Bible-school course records, as the website's MEMBER_COURSE_GROUPS. */
export const MEMBER_COURSES = [
  { key: 'believerFoundationClass', status: 'believerFoundationClassStatus', date: 'believerFoundationClassDate', location: 'believerFoundationClassLocation' },
  { key: 'bcc', status: 'bccStatus', date: 'bccDate', location: 'bccLocation' },
  { key: 'lcc', status: 'lccStatus', date: 'lccDate', location: 'lccLocation' },
  { key: 'lcd', status: 'lcdStatus', date: 'lcdDate', location: 'lcdLocation' },
] as const;

/** Same rules as the website's normalizeYesNoValue. */
export function yesNo(value?: string | null): 'yes' | 'no' | '' {
  if (!value) return '';
  const normalized = value.toLowerCase();
  if (['yes', 'completed', 'received', 'in_progress'].includes(normalized)) return 'yes';
  if (['no', 'not_started', 'not_yet'].includes(normalized)) return 'no';
  return '';
}

export function memberGroupNames(member: Pick<MemberListItem, 'serviceUnitIds' | 'serviceUnitId' | 'serviceUnitInterest'>) {
  if (Array.isArray(member.serviceUnitIds)) {
    return member.serviceUnitIds
      .map((unit) => unit?.name)
      .filter(Boolean)
      .join('; ');
  }
  return member.serviceUnitId?.name || member.serviceUnitInterest || '';
}

export function memberGroupIds(member: Pick<MemberListItem, 'serviceUnitIds' | 'serviceUnitId'>) {
  if (Array.isArray(member.serviceUnitIds)) return member.serviceUnitIds.map((unit) => unit?._id).filter((id): id is string => !!id);
  return member.serviceUnitId?._id ? [member.serviceUnitId._id] : [];
}

export function unitBranchId(unit: ServiceUnitSummary) {
  return typeof unit.branchId === 'string' ? unit.branchId : (unit.branchId?._id ?? '');
}

/** yyyy-mm-dd, today or earlier, like the API's validatePastOrTodayDate. */
export function isValidPastDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  const max = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;
  return value <= max;
}
