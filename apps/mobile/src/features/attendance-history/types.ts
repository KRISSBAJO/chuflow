import type { BranchRef } from '@/lib/types';

/* A service summary as GET /attendance (entryMode=summary) and GET /attendance/:id return it. */

export type CountKey = 'menCount' | 'womenCount' | 'childrenCount' | 'adultsCount' | 'firstTimersCount' | 'newConvertsCount' | 'holySpiritBaptismCount';

export type AttendanceSummaryRecord = {
  _id: string;
  entryMode?: string;
  branchId?: BranchRef | string;
  serviceDate: string;
  serviceType?: string;
  serviceTypeLabel?: string;
  serviceTypeId?: { _id?: string; name?: string } | string;
  serviceScheduleId?: { _id?: string; name?: string } | string;
  serviceName?: string;
  menCount?: number;
  womenCount?: number;
  childrenCount?: number;
  adultsCount?: number;
  firstTimersCount?: number;
  newConvertsCount?: number;
  holySpiritBaptismCount?: number;
  createdBy?: { firstName?: string; lastName?: string } | string;
  createdAt?: string;
  updatedAt?: string;
};

/** The counts a phone edits; adults are men + women, as the door counter records them. */
export const EDITABLE_COUNTS = ['menCount', 'womenCount', 'childrenCount'] as const satisfies readonly CountKey[];
export const OF_THOSE_COUNTS = ['firstTimersCount', 'newConvertsCount', 'holySpiritBaptismCount'] as const satisfies readonly CountKey[];

export function serviceLabel(record: AttendanceSummaryRecord) {
  const typeName = typeof record.serviceTypeId === 'object' ? record.serviceTypeId?.name : undefined;
  return record.serviceName || typeName || record.serviceTypeLabel || record.serviceType || '';
}

/** Everyone counted: adults + children, or men + women + children for older records without an adults total. */
export function peopleCount(record: AttendanceSummaryRecord) {
  const fromAdults = (record.adultsCount ?? 0) + (record.childrenCount ?? 0);
  return fromAdults || (record.menCount ?? 0) + (record.womenCount ?? 0) + (record.childrenCount ?? 0);
}
