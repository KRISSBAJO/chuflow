import type { Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { forwardRef, useEffect, useState, type ComponentRef, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '@/components/icon';
import { LiveDot, Meter } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Field, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT, type Translator } from '@/i18n/provider';
import { query } from '@/lib/api';
import type { Tone } from '@/lib/format';
import { splitMonths } from './age';
import type { Phase } from './types';

/* Feature-only pieces for the Kids workspace: the website's warmer kids palette, used sparingly. */

export const KIDS = {
  green: '#245b4b',
  greenSoft: '#eef4f0',
  amber: '#e3a84f',
  amberSoft: '#fff7e6',
  amberInk: '#6e4511',
} as const;

export const MIN_REASON = 10;

/** Typed routes lag behind newly added screens; string hrefs keep navigation compiling until the route map regenerates. */
export const kidsHref = (path: string, params: Record<string, string | number | undefined | null | false> = {}) => `${path}${query(params)}` as Href;

export const PHASE_TONE: Record<Phase, Tone> = {
  upcoming: 'warning',
  live: 'success',
  ending: 'warning',
  overdue: 'danger',
  closed: 'neutral',
};

const PHASE_BG: Record<Phase, string> = {
  upcoming: colors.warningBg,
  live: KIDS.greenSoft,
  ending: colors.warningBg,
  overdue: colors.dangerBg,
  closed: colors.surfaceStrong,
};

const PHASE_FG: Record<Phase, string> = {
  upcoming: colors.warning,
  live: KIDS.green,
  ending: colors.warning,
  overdue: colors.danger,
  closed: colors.text,
};

/** Session phase pill with a live dot, like the website's `children-badge`. */
export function PhaseBadge({ phase }: { phase: Phase }) {
  const t = useT('kids.phase');
  return (
    <View style={[styles.phase, { backgroundColor: PHASE_BG[phase] }]}>
      <LiveDot tone={PHASE_TONE[phase]} size={7} />
      <Text style={[styles.phaseText, { color: PHASE_FG[phase] }]}>{t(phase)}</Text>
    </View>
  );
}

/** Small uppercase lead-in above a heading ("A · Scan a card"). */
export function Kicker({ children }: { children: ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

/** Round initial marker used for families and children. */
export function InitialAvatar({ text, size = 36, tone = 'green' }: { text: string; size?: number; tone?: 'green' | 'amber' | 'plain' }) {
  const bg = tone === 'green' ? KIDS.greenSoft : tone === 'amber' ? KIDS.amberSoft : colors.surfaceStrong;
  const fg = tone === 'green' ? KIDS.green : tone === 'amber' ? KIDS.amberInk : colors.text;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: Math.round(size * 0.38), color: fg }}>{text}</Text>
    </View>
  );
}

/** Classroom card with a capacity meter; `onPress` is optional, `selected` draws a green outline. */
export function RoomCard({
  name,
  subtitle,
  present,
  capacity,
  onPress,
  selected,
  style,
}: {
  name: string;
  subtitle?: string;
  present: number;
  capacity: number;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT('kids.common');
  const remaining = Math.max(0, capacity - present);
  const full = capacity > 0 && present >= capacity;
  const body = (
    <>
      <Text style={type.label} numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? <Caption numberOfLines={1}>{subtitle}</Caption> : null}
      <View style={styles.roomTop}>
        <Text style={[styles.roomCount, { flexShrink: 0 }]}>
          {present}
          <Text style={styles.roomCapacity}> / {capacity}</Text>
        </Text>
        <Text style={[type.micro, { flex: 1, textAlign: 'right' }, full ? { color: colors.danger } : null]} numberOfLines={2}>
          {full ? t('full') : t('spaces', { count: remaining })}
        </Text>
      </View>
      <Meter value={present} max={capacity} style={{ marginTop: 6 }} />
    </>
  );
  const base = [styles.room, selected && styles.roomSelected, style];
  if (!onPress) return <View style={base}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [...base, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

type CodeInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  onScan?: () => void;
  scanLabel?: string;
  submitLabel: string;
  busy?: boolean;
};

/**
 * Large monospace code box for card and receipt codes. A Bluetooth scanner types the code and
 * sends Enter, which triggers `onSubmit`; the camera button opens the scan screen.
 */
export const CodeInput = forwardRef<ComponentRef<typeof TextInput>, CodeInputProps>(function CodeInput(
  { label, value, onChangeText, onSubmit, placeholder, autoFocus, onScan, scanLabel, submitLabel, busy },
  ref,
) {
  return (
    <View style={{ gap: space.sm }}>
      <Field
        ref={ref}
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        returnKeyType="go"
        blurOnSubmit={false}
        onSubmitEditing={onSubmit}
        style={styles.code}
      />
      <View style={styles.codeActions}>
        <Button label={submitLabel} size="lg" loading={busy} disabled={!value.trim()} onPress={onSubmit} style={{ flex: 1.4 }} />
        {onScan ? <Button label={scanLabel ?? ''} icon="camera" variant="secondary" size="lg" onPress={onScan} style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
});

/** The pickup code in large letters; tapping copies the scannable code. */
export function BigCode({ display, code, copiedLabel }: { display: string; code?: string; copiedLabel: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap('medium');
        void Clipboard.setStringAsync(code ?? display).then(() => toast.success(copiedLabel));
      }}
      style={({ pressed }) => [styles.bigCode, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.bigCodeText}>{display}</Text>
      <Icon name="copy" size={16} color={colors.muted} />
    </Pressable>
  );
}

/** Inline amber panel asking for a supervisor note of at least ten characters. */
export function ReasonForm({
  title,
  body,
  busy,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useT('kids.desk');
  const tc = useT('common.actions');
  const [reason, setReason] = useState('');
  const missing = MIN_REASON - reason.trim().length;
  return (
    <View style={styles.reason}>
      <Text style={[type.label, { color: KIDS.amberInk }]}>{title}</Text>
      <Caption>{body}</Caption>
      <Field
        label={t('supervisor.reason.label')}
        value={reason}
        onChangeText={setReason}
        placeholder={t('supervisor.reason.placeholder')}
        multiline
        autoFocus
        hint={reason.length > 0 && missing > 0 ? t('pickup.reasonShort', { count: missing }) : undefined}
      />
      <View style={styles.codeActions}>
        <Button label={tc('cancel')} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} loading={busy} disabled={missing > 0} onPress={() => onConfirm(reason.trim())} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}

/** Native confirm with a web fallback, like approvals.tsx. */
export function confirmAction(title: string, message: string, confirmLabel: string, cancelLabel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

/** Current time rounded to the minute, refreshed every 30 s, so "in for 42 min" stays fresh. */
export function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** "2 yrs 3 mo" style age label from completed months. */
export function ageLabel(t: Translator, months: number | null) {
  if (months === null) return t('unknown');
  if (months === 0) return t('newborn');
  const { years, months: m } = splitMonths(months);
  if (years === 0) return t('months', { count: m });
  if (m === 0) return t('years', { count: years });
  return t('yearsMonths', { years, months: m });
}

/** "2y 3m" compact label used in the session form. */
export function ageShort(t: Translator, months: number) {
  const { years, months: m } = splitMonths(months);
  if (years === 0) return t('monthsShort', { months: m });
  if (m === 0) return t('yearsShort', { years });
  return t('yearsMonthsShort', { years, months: m });
}

const styles = StyleSheet.create({
  phase: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  phaseText: { fontFamily: fonts.medium, fontSize: 11.5 },
  kicker: { ...type.micro, textTransform: 'uppercase', color: KIDS.green },
  room: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  roomSelected: { borderColor: KIDS.green, backgroundColor: KIDS.greenSoft },
  roomTop: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  roomCount: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: colors.ink, marginTop: 4, fontVariant: ['tabular-nums'] },
  roomCapacity: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 17, minHeight: 52, letterSpacing: 1 },
  codeActions: { flexDirection: 'row', gap: space.sm },
  bigCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backgroundColor: colors.inset,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  bigCodeText: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 28, letterSpacing: 4, color: colors.ink },
  reason: { backgroundColor: KIDS.amberSoft, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: '#f3dcb3' },
});
