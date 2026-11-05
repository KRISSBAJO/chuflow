import { BadRequestException } from '@nestjs/common';
export const CARE_ROLES = [
  'branch_admin',
  'resident_pastor',
  'associate_pastor',
  'follow_up',
];
export const CARE_STAGES = [
  'new',
  'connecting',
  'connected',
  'paused',
  'closed',
];
export const CARE_OUTCOMES = [
  'contacted',
  'no_answer',
  'callback_requested',
  'needs_help',
  'connected',
  'declined',
  'resolved',
];
export function normalizeCareEmail(value?: string) {
  const s = value?.trim().toLowerCase();
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : undefined;
}
export function careAllowed(
  c: {
    stopContact: boolean;
    mergedInto?: unknown;
    stage: string;
    pausedUntil?: Date;
  },
  now = Date.now(),
) {
  return (
    !c.stopContact &&
    !c.mergedInto &&
    c.stage !== 'closed' &&
    !(
      c.stage === 'paused' &&
      (!c.pausedUntil || +new Date(c.pausedUntil) > now)
    )
  );
}
export function contactWindow(
  at: Date,
  zone: string,
  start: number,
  end: number,
) {
  let value = new Date(at);
  for (let n = 0; n < 192; n++) {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(value),
    );
    const quiet =
      start === end
        ? false
        : start > end
          ? hour >= start || hour < end
          : hour >= start && hour < end;
    if (!quiet) return value;
    value = new Date(+value + 15 * 60000);
  }
  throw new BadRequestException('No contact window is available.');
}
export function retentionEvidence(
  input: {
    reliable: boolean;
    coverageFrom?: Date;
    count: number;
    minimum: number;
    last?: Date;
    gapDays: number;
    paused: boolean;
  },
  now = Date.now(),
) {
  if (!input.reliable || !input.coverageFrom)
    return {
      eligible: false,
      reason: 'Individual attendance coverage has not been confirmed.',
    };
  if (input.paused)
    return {
      eligible: false,
      reason: 'Care is paused or an absence is explained.',
    };
  if (
    !input.last ||
    input.count < input.minimum ||
    +input.last < +input.coverageFrom
  )
    return {
      eligible: false,
      reason: 'Not enough individual attendance observations.',
    };
  const days = Math.floor((now - +input.last) / 86400000);
  return {
    eligible: days >= input.gapDays,
    reason: `${days} days since the last recorded individual attendance; ${input.count} observations in the baseline.`,
    days,
  };
}
export function renderCareTemplate(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(
    /\{\{(firstName|churchName|checkInUrl)\}\}/g,
    (_, key: string) => values[key] || '',
  );
}
