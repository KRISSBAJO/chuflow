import { useMemo } from 'react';
import { useT } from '@/i18n/provider';
import { yesNo } from './types';

/** Translated member option labels; unknown API values are humanised like the website. */
export function useMemberLabels() {
  const t = useT('members.options');
  return useMemo(() => {
    const humanise = (value: string) =>
      value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    return {
      membershipStatus: (value?: string | null) => {
        if (!value) return t('notRecorded');
        const key = `membershipStatus.${value.toLowerCase()}`;
        return t.has(key) ? t(key) : humanise(value);
      },
      title: (value?: string | null) => {
        if (!value) return '';
        const key = `title.${value.toLowerCase()}`;
        return t.has(key) ? t(key) : humanise(value);
      },
      yesNo: (value?: string | null) => {
        const normalized = yesNo(value);
        if (normalized === 'yes') return t('yesNo.yes');
        if (normalized === 'no') return t('yesNo.no');
        return value ? humanise(value) : t('notRecorded');
      },
      course: (key: string) => (t.has(`courses.${key}`) ? t(`courses.${key}`) : key.toUpperCase()),
      notRecorded: t('notRecorded'),
    };
  }, [t]);
}

/** "Pastor Ada Okafor" — the title in front of the name, as the website's roster shows it. */
export function memberDisplayName(labels: ReturnType<typeof useMemberLabels>, member: { title?: string; firstName?: string; lastName?: string }, fallback: string) {
  const name = [labels.title(member.title), member.firstName, member.lastName].filter(Boolean).join(' ');
  return name || fallback;
}
