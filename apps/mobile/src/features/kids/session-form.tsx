import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { DateStepper, SheetPicker } from '@/components/kit';
import { Badge, Button, Caption, Card, Chip, EmptyState, Field, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { localDateValue, localTimeValue, MAX_MONTHS, parseTime, ROOM_TEMPLATES, splitMonths, type RoomTemplateKey } from './age';
import { ageShort, KIDS, Kicker, kidsHref } from './shared';
import type { LatestRooms } from './types';

type RoomDraft = { key: string; name: string; minMonths: number; maxMonths: number; capacity: number };
type RoomError = 'nameRequired' | 'duplicateName' | 'maxBelowMin' | 'capacity';
type Quick = 'now' | 'sunday' | 'sundayLate' | 'midweek' | 'saturday';

const SUGGESTIONS = ['sundayFirst', 'sundaySecond', 'midweek', 'special', 'holiday'] as const;
const QUICK: Quick[] = ['now', 'sunday', 'sundayLate', 'midweek', 'saturday'];
let roomSeq = 0;
const roomKey = () => `r${++roomSeq}`;

function nextWeekday(weekday: number, from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return d;
}

function quickPick(kind: Quick) {
  const now = new Date();
  if (kind === 'now') {
    const start = new Date(now);
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
    const end = new Date(start.getTime() + 3 * 3600_000);
    return { date: new Date(start), start: localTimeValue(start), end: localTimeValue(end) };
  }
  const spec = {
    sunday: { day: 0, start: '09:00', end: '12:30' },
    sundayLate: { day: 0, start: '11:00', end: '13:30' },
    midweek: { day: 3, start: '18:00', end: '20:00' },
    saturday: { day: 6, start: '10:00', end: '13:00' },
  }[kind];
  let day = nextWeekday(spec.day, now);
  if (new Date(`${localDateValue(day)}T${spec.end}:00`) <= now) day = nextWeekday(spec.day, new Date(day.getTime() + 86_400_000));
  return { date: day, start: spec.start, end: spec.end };
}

/** "Nursery 0–2" → "Nursery". */
const shortName = (label: string) => label.replace(/\s*\d+\s*[–-]\s*\d+\s*$/, '').trim() || label;

/** Opens a children's session: name, time window and classrooms, like the website's session form. */
export function NewSessionScreen() {
  const params = useLocalSearchParams<{ branchId?: string }>();
  const t = useT('kids.session');
  const ta = useT('kids.age');
  const tk = useT('kids.common');
  const format = useAppFormat();
  const { user } = useSession();
  const supervise = can.kidsSupervise(user?.role);
  const pickBranch = can.pickBranch(user?.role);
  const branches = useApi<BranchSummary[]>(pickBranch && supervise ? '/branches' : null);

  const [branchId, setBranchId] = useState(params.branchId || userBranchId(user));
  const [name, setName] = useState('');
  const [when, setWhen] = useState(() => quickPick('sunday'));
  const [rooms, setRooms] = useState<RoomDraft[]>(() =>
    (['nursery', 'preschool', 'kids'] as const).map((k) => {
      const tpl = ROOM_TEMPLATES.find((r) => r.key === k)!;
      return { key: roomKey(), name: shortName(t(`template.${k}`)), minMonths: tpl.minMonths, maxMonths: tpl.maxMonths, capacity: tpl.capacity };
    }),
  );
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reusing, setReusing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const registrationKey = useRef('');

  const branchList = branches.data ?? [];
  const effectiveBranch = branchId || (branchList.length === 1 ? branchList[0]._id : '');

  const startMin = parseTime(when.start);
  const endMin = parseTime(when.end);
  const startsAt = startMin === null ? null : new Date(when.date.getFullYear(), when.date.getMonth(), when.date.getDate(), Math.floor(startMin / 60), startMin % 60);
  const endsAt = endMin === null ? null : new Date(when.date.getFullYear(), when.date.getMonth(), when.date.getDate(), Math.floor(endMin / 60), endMin % 60);
  const durationMin = startsAt && endsAt ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000) : 0;
  const timeError =
    startMin === null || endMin === null ? t('invalidTime') : startsAt && endsAt ? (durationMin <= 0 ? t('endBeforeStart') : endsAt <= new Date() ? t('endInPast') : '') : '';

  const roomErrors = rooms.map((r) => {
    const errs: RoomError[] = [];
    if (!r.name.trim()) errs.push('nameRequired');
    else if (rooms.some((o) => o !== r && o.name.trim().toLowerCase() === r.name.trim().toLowerCase())) errs.push('duplicateName');
    if (r.maxMonths < r.minMonths) errs.push('maxBelowMin');
    if (!(r.capacity >= 1 && r.capacity <= 500)) errs.push('capacity');
    return errs;
  });
  const roomsValid = roomErrors.every((e) => !e.length);
  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
  const nameValid = name.trim().length >= 2;
  const canSubmit = !busy && !!effectiveBranch && nameValid && !timeError && roomsValid && rooms.length > 0;

  const hints = useMemo(() => {
    const out: string[] = [];
    const sorted = rooms.filter((r) => r.maxMonths >= r.minMonths).sort((a, b) => a.minMonths - b.minMonths);
    const age = (m: number) => ageShort(ta, m);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.minMonths > prev.maxMonths + 1) out.push(t('hints.gap', { from: age(prev.maxMonths + 1), to: age(cur.minMonths - 1) }));
      else if (cur.minMonths <= prev.maxMonths && prev.name && cur.name) out.push(t('hints.overlap', { a: prev.name, b: cur.name }));
    }
    if (sorted.length) out.push(t('hints.covered', { from: age(sorted[0].minMonths), to: age(Math.max(...sorted.map((r) => r.maxMonths))) }));
    return out;
  }, [rooms, t, ta]);

  function patchRoom(key: string, patch: Partial<RoomDraft>) {
    setRooms((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addTemplate(k: RoomTemplateKey) {
    const tpl = ROOM_TEMPLATES.find((r) => r.key === k)!;
    const label = shortName(t(`template.${k}`));
    setRooms((rows) =>
      rows.length >= 20
        ? rows
        : [...rows, { key: roomKey(), name: rows.some((r) => r.name.toLowerCase() === label.toLowerCase()) ? `${label} ${rows.length + 1}` : label, minMonths: tpl.minMonths, maxMonths: tpl.maxMonths, capacity: tpl.capacity }],
    );
  }

  async function reuse() {
    setReusing(true);
    setNotice('');
    setError('');
    try {
      const last = await api.get<LatestRooms>(`/children/sessions/latest-rooms?branchId=${encodeURIComponent(effectiveBranch)}`);
      if (!last) {
        setNotice(t('reuseNone'));
        return;
      }
      setRooms(last.rooms.slice(0, 20).map((r) => ({ key: roomKey(), ...r })));
      if (!name.trim()) setName(last.name);
      const s = new Date(last.startsAt);
      const e = new Date(last.endsAt);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
        let day = nextWeekday(s.getDay());
        if (new Date(`${localDateValue(day)}T${localTimeValue(e)}:00`) <= new Date()) day = nextWeekday(s.getDay(), new Date(day.getTime() + 86_400_000));
        setWhen({ date: day, start: localTimeValue(s), end: localTimeValue(e) });
      }
      setNotice(t('reuseDone', { name: last.name }));
    } catch (e) {
      setError(errorMessage(e, t('reuseError')));
    } finally {
      setReusing(false);
    }
  }

  async function submit() {
    setSubmitted(true);
    if (!canSubmit || !startsAt || !endsAt) return;
    if (!registrationKey.current) registrationKey.current = uuid();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ _id: string }>('/children/sessions', {
        registrationKey: registrationKey.current,
        branchId: effectiveBranch,
        name: name.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        rooms: rooms.map(({ name: roomName, minMonths, maxMonths, capacity }) => ({ name: roomName.trim(), minMonths, maxMonths, capacity })),
      });
      router.replace(kidsHref(`/kids/sessions/${r._id}`, { tab: 'checkin' }));
    } catch (e) {
      setError(errorMessage(e, t('openError')));
      setBusy(false);
    }
  }

  if (!supervise) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={tk('supervisorOnly')} />
      </Screen>
    );
  }

  const durationText =
    durationMin > 0
      ? durationMin % 60 === 0
        ? t('durationH', { hours: durationMin / 60 })
        : durationMin < 60
          ? t('durationM', { minutes: durationMin })
          : t('durationHM', { hours: Math.floor(durationMin / 60), minutes: durationMin % 60 })
      : '—';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        safeTop={false}
        footer={
          <View style={styles.footer}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type.label} numberOfLines={1}>
                {name.trim() || t('namePlaceholder')}
              </Text>
              <Caption numberOfLines={1}>
                {t('summary', { rooms: rooms.length, places: totalCapacity })}
                {startsAt && endsAt && !timeError ? ` · ${format.date(startsAt, { weekday: 'short', day: 'numeric', month: 'short' })} ${when.start}–${when.end}` : ''}
              </Caption>
            </View>
            <Button label={busy ? t('opening') : t('open')} icon="door" loading={busy} disabled={submitted && !canSubmit} onPress={() => void submit()} />
          </View>
        }
      >
        <Stack.Screen options={{ title: t('title') }} />
        <Caption>{t('intro')}</Caption>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? (
          <Notice tone="success" icon="check">
            {notice}
          </Notice>
        ) : null}

        <Section title={t('stepBasics')} />
        {pickBranch && branchList.length > 1 ? (
          <SheetPicker label={tk('church')} value={effectiveBranch} options={branchList.map((b) => ({ value: b._id, label: b.name }))} onChange={setBranchId} required error={submitted && !effectiveBranch ? t('errors.branch') : undefined} />
        ) : null}
        <Field label={t('name')} required value={name} onChangeText={setName} placeholder={t('namePlaceholder')} maxLength={120} error={submitted && !nameValid ? t('errors.sessionName') : undefined} />
        <View style={styles.chips}>
          {SUGGESTIONS.map((k) => (
            <Chip key={k} label={t(`suggestions.${k}`)} selected={name === t(`suggestions.${k}`)} onPress={() => setName(t(`suggestions.${k}`))} />
          ))}
        </View>

        <View style={styles.chips}>
          {QUICK.map((k) => (
            <Chip key={k} label={t(`quick.${k}`)} icon={k === 'now' ? 'sparkle' : 'calendar'} selected={false} onPress={() => setWhen(quickPick(k))} />
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>{t('date')}</Text>
          <DateStepper value={when.date} max={null} min={new Date()} label={format.longDate(when.date)} onChange={(date) => setWhen({ ...when, date })} />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={t('starts')} value={when.start} onChangeText={(start) => setWhen({ ...when, start })} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} hint={t('timeHint')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('ends')} value={when.end} onChangeText={(end) => setWhen({ ...when, end })} placeholder="12:30" keyboardType="numbers-and-punctuation" maxLength={5} error={timeError || undefined} />
          </View>
        </View>
        <View style={styles.chips}>
          <Badge label={`${t('durationLabel')}: ${durationText}`} tone="info" />
        </View>

        <Section title={t('stepRooms')} action={reusing ? t('reuseLoading') : t('reuse')} onAction={() => (reusing || !effectiveBranch ? undefined : void reuse())} />
        <Caption>{t('roomsIntro')}</Caption>
        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>{t('templates')}</Text>
          <View style={styles.chips}>
            {ROOM_TEMPLATES.map((tpl) => (
              <Chip key={tpl.key} label={`+ ${t(`template.${tpl.key}`)}`} selected={false} onPress={() => addTemplate(tpl.key)} />
            ))}
          </View>
        </View>

        {rooms.map((r, i) => {
          const errs = roomErrors[i];
          const show = submitted || r.name.length > 0;
          return (
            <Card key={r.key} style={[styles.roomCard, { borderTopColor: COVERAGE[i % COVERAGE.length] }]}>
              <View style={styles.roomHead}>
                <Kicker>{t('room', { n: i + 1 })}</Kicker>
                <Badge label={`${ageShort(ta, r.minMonths)} – ${ageShort(ta, r.maxMonths)}`} />
                <View style={{ flex: 1 }} />
                {rooms.length > 1 ? (
                  <Pressable
                    accessibilityLabel={t('removeRoom')}
                    hitSlop={8}
                    onPress={() => {
                      tap();
                      setRooms((rows) => rows.filter((x) => x.key !== r.key));
                    }}
                  >
                    <Icon name="trash" size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
              <Field label={t('roomName')} value={r.name} onChangeText={(value) => patchRoom(r.key, { name: value })} placeholder={t('roomNamePlaceholder')} maxLength={60} error={show && errs.some((e) => e === 'nameRequired' || e === 'duplicateName') ? t(`errors.${errs.find((e) => e === 'nameRequired' || e === 'duplicateName')!}`) : undefined} />
              <View style={styles.row}>
                <AgeInput label={t('minAge')} value={r.minMonths} onChange={(m) => patchRoom(r.key, { minMonths: m })} years={t('years')} months={t('months')} />
                <AgeInput label={t('maxAge')} value={r.maxMonths} onChange={(m) => patchRoom(r.key, { maxMonths: m })} years={t('years')} months={t('months')} invalid={r.maxMonths < r.minMonths} />
                <View style={{ width: 82 }}>
                  <Field label={t('capacity')} value={String(r.capacity || '')} onChangeText={(value) => patchRoom(r.key, { capacity: Number(value.replace(/\D/g, '')) })} keyboardType="number-pad" maxLength={3} error={errs.includes('capacity') ? ' ' : undefined} />
                </View>
              </View>
              {show && errs.some((e) => e === 'maxBelowMin' || e === 'capacity') ? (
                <Text style={[type.small, { color: colors.danger }]}>{errs.filter((e) => e === 'maxBelowMin' || e === 'capacity').map((e) => t(`errors.${e}`)).join(' ')}</Text>
              ) : null}
            </Card>
          );
        })}
        <View style={styles.chips}>
          <Button label={t('addRoom')} icon="plus" variant="secondary" size="sm" disabled={rooms.length >= 20} onPress={() => setRooms([...rooms, { key: roomKey(), name: '', minMonths: 0, maxMonths: 215, capacity: 20 }])} />
          <Caption>{t('maxRooms')}</Caption>
        </View>

        {hints.length ? (
          <View style={{ gap: 2 }}>
            {hints.map((h) => (
              <Caption key={h}>· {h}</Caption>
            ))}
          </View>
        ) : null}
        <Caption>{t('oneOpen')}</Caption>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const COVERAGE = [KIDS.green, KIDS.amber, '#6f9ccb', '#8c6fb8', '#d97a6a', '#88b8a9'];

function AgeInput({ label, value, onChange, years, months, invalid }: { label: string; value: number; onChange: (months: number) => void; years: string; months: string; invalid?: boolean }) {
  const split = splitMonths(value);
  const clamp = (m: number) => Math.min(MAX_MONTHS, Math.max(0, m));
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.ageRow}>
        <View style={{ flex: 1 }}>
          <Field label={years} value={String(split.years)} onChangeText={(v) => onChange(clamp(Number(v.replace(/\D/g, '')) * 12 + split.months))} keyboardType="number-pad" maxLength={2} error={invalid ? ' ' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={months} value={String(split.months)} onChangeText={(v) => onChange(clamp(split.years * 12 + Math.min(11, Number(v.replace(/\D/g, '')))))} keyboardType="number-pad" maxLength={2} error={invalid ? ' ' : undefined} />
        </View>
      </View>
    </View>
  );
}

function uuid() {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  ageRow: { flexDirection: 'row', gap: 6 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  roomCard: { gap: space.sm, borderTopWidth: 3, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
