import type { Tone } from '@/lib/format';
import type { Translator } from '@/i18n/provider';
import type { MeetingListItem } from './types';

export const STATUS_TONE: Record<string, Tone> = { scheduled: 'info', ongoing: 'success', completed: 'neutral', cancelled: 'danger' };
export const MINUTES_TONE: Record<string, Tone> = { overdue: 'danger', draft: 'warning', submitted: 'info', approved: 'success', changes_requested: 'danger' };

export function statusLabel(t: Translator, status: string) {
  return t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status.replace(/_/g, ' ');
}

export function minutesLabel(t: Translator, m: Pick<MeetingListItem, 'minutesStatus' | 'minutesOverdue' | 'minutesRequired'>) {
  if (!m.minutesRequired && (!m.minutesStatus || m.minutesStatus === 'draft')) return '';
  const key = m.minutesOverdue ? 'overdue' : m.minutesStatus;
  return t.has(`minutesStatuses.${key}`) ? t(`minutesStatuses.${key}`) : key.replace(/_/g, ' ');
}

export function participantCount(m: Pick<MeetingListItem, 'attendeeUserIds' | 'attendeeMemberIds'>) {
  return (m.attendeeUserIds?.length ?? 0) + (m.attendeeMemberIds?.length ?? 0);
}
