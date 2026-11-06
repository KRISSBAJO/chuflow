import { useCallback } from 'react';
import { useT } from '@/i18n/provider';
import type { Tone } from '@/lib/format';

/** Translated care label for an API value (stage, journey, outcome, event kind…), humanised when unknown. */
export function useCareLabel() {
  const t = useT('care.labels');
  return useCallback(
    (value?: string | null) => {
      if (!value) return '';
      if (t.has(value)) return t(value);
      const text = value.replace(/_/g, ' ');
      return text.charAt(0).toUpperCase() + text.slice(1);
    },
    [t],
  );
}

export function stageTone(stage?: string, stopContact?: boolean): Tone {
  if (stopContact) return 'danger';
  switch (stage) {
    case 'connected':
      return 'success';
    case 'connecting':
      return 'info';
    case 'new':
      return 'warning';
    case 'paused':
      return 'neutral';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function eventTone(kind: string, outcome?: string): Tone {
  if (outcome === 'needs_help' || outcome === 'declined') return 'danger';
  if (outcome === 'no_answer') return 'warning';
  if (outcome === 'connected' || outcome === 'resolved' || kind === 'complete' || kind === 'membership_recorded' || kind === 'return_visit_recorded') return 'success';
  if (kind === 'contact' || kind === 'legacy_followup') return 'info';
  if (kind === 'escalation' || kind === 'staff_escalation') return 'danger';
  return 'neutral';
}
