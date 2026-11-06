import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { SheetPicker } from '@/components/kit';
import { Chip } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import type { AppFormat } from '@/i18n/format';
import { translate } from '@/i18n/provider';
import { isoDay, toLocalDate } from '@/lib/format';
import type { BranchSummary } from '@/lib/types';

/* Small pieces shared by the finance screens (and borrowed by attendance history). */

const DAY = 86_400_000;

/** Native confirm with a web fallback, like approvals.tsx. */
export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: translate('common.actions.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Amounts always show cents, as on the website's finance pages. */
export function moneyOf(format: AppFormat) {
  return (amount: number | undefined | null, currency?: string | null) =>
    format.money(amount ?? 0, currency || 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "Today · 6 Nov" while the relative label applies, otherwise the plain date. */
export function dayLabel(format: AppFormat, value: Date | string) {
  const date = toLocalDate(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = start.getTime() - new Date(date).setHours(0, 0, 0, 0);
  const relative = diff >= -DAY && diff < 6 * DAY;
  const plain = format.date(date, { weekday: 'short', day: 'numeric', month: 'short' });
  return relative ? `${format.shortDate(date)} · ${plain}` : plain;
}

/** Parses "1,250.50" / "1250,50" into a number; NaN when it isn't one. */
export function parseAmount(text: string) {
  const cleaned = text.replace(/\s/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return NaN;
  return Math.round(Number(cleaned) * 100) / 100;
}

/** Date filter bounds for a list: `dateFrom` as a day, `dateTo` as the end of today (UTC-safe, like the website). */
export function periodQuery(from: Date | null, today: Date) {
  if (!from) return {};
  return { dateFrom: isoDay(from), dateTo: `${isoDay(today)}T23:59:59.999Z` };
}

export function startOfMonth(today: Date) {
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

export function startOfYear(today: Date) {
  return new Date(today.getFullYear(), 0, 1);
}

export function daysAgo(today: Date, days: number) {
  const date = new Date(today);
  date.setDate(today.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Monday of the current week. */
export function startOfWeek(today: Date) {
  return daysAgo(today, (today.getDay() + 6) % 7);
}

/** A row of range chips. */
export function RangeChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

/** Branch filter for roles that see more than one branch; "" means every branch in scope. */
export function BranchFilter({ label, allLabel, branches, value, onChange }: { label: string; allLabel: string; branches: BranchSummary[]; value: string; onChange: (value: string) => void }) {
  if (branches.length < 2) return null;
  return (
    <SheetPicker<string>
      label={label}
      value={value}
      options={[{ value: '', label: allLabel }, ...branches.map((branch) => ({ value: branch._id, label: branch.name, hint: [branch.district, branch.oversightRegion].filter(Boolean).join(' · ') }))]}
      onChange={onChange}
      searchable={branches.length > 8}
    />
  );
}

/** Right-aligned amount for list rows. */
export function Amount({ children, tone = 'ink' }: { children: string; tone?: 'ink' | 'success' | 'danger' }) {
  return <Text style={[styles.amount, tone === 'success' && { color: colors.success }, tone === 'danger' && { color: colors.danger }]}>{children}</Text>;
}

/** Large amount at the top of a detail screen. */
export function BigAmount({ children, caption }: { children: string; caption?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.bigAmount}>{children}</Text>
      {caption ? <Text style={type.small}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amount: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  bigAmount: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, fontVariant: ['tabular-nums'] },
});
