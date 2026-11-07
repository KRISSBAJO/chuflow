import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { DateStepper } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Loading, Notice, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage, getApiSession, NetworkError } from '@/lib/api';
import { isoDay } from '@/lib/format';
import { queueAttendance, useOnline } from '@/lib/offline-queue';
import { can, canManageLocalServiceTypes } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary, ServiceType } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/*
 * Counting a service, one question per screen: branch (for roles that pick one), service, day,
 * then each headcount with a big stepper, then a review. Each step slides in; the bar on top
 * fills as you go. With no signal the count waits on the phone and sends later.
 */

type CountKey = 'menCount' | 'womenCount' | 'childrenCount' | 'firstTimersCount' | 'newConvertsCount' | 'holySpiritBaptismCount';
type Counts = Record<CountKey, number>;
type StepKey = 'branch' | 'service' | 'date' | CountKey | 'review';

const HEADCOUNT: CountKey[] = ['menCount', 'womenCount', 'childrenCount'];
const OF_THOSE: CountKey[] = ['firstTimersCount', 'newConvertsCount', 'holySpiritBaptismCount'];

/** Message keys under attendance.flow for each count step. */
const FLOW_KEY: Record<CountKey, string> = {
  menCount: 'men',
  womenCount: 'women',
  childrenCount: 'children',
  firstTimersCount: 'firstTimers',
  newConvertsCount: 'newConverts',
  holySpiritBaptismCount: 'holySpirit',
};

const EMPTY: Counts = { menCount: 0, womenCount: 0, childrenCount: 0, firstTimersCount: 0, newConvertsCount: 0, holySpiritBaptismCount: 0 };

const serviceTypesCacheKey = (branchId: string) => {
  const scope = getApiSession().storageScope;
  return `chuflow.serviceTypes.${scope ? scope + '.' : ''}${branchId || 'all'}`;
};
const native = Platform.OS !== 'web';

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysBefore(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() - days);
  return next;
}

function OptionRow({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.label, { fontSize: 16 }]} numberOfLines={2}>
          {label}
        </Text>
        {hint ? <Caption numberOfLines={1}>{hint}</Caption> : null}
      </View>
      <View style={[styles.optionMark, selected && styles.optionMarkSelected]}>{selected ? <Icon name="check" size={14} color="#ffffff" strokeWidth={2.5} /> : null}</View>
    </Pressable>
  );
}

function BigCounter({ label, value, onChange, hint }: { label: string; value: number; onChange: (next: number) => void; hint: string }) {
  const t = useT('attendance.count');
  const step = (delta: number) => {
    tap();
    onChange(Math.max(0, value + delta));
  };
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.bigCounter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('removeOne', { label })}
          onPress={() => step(-1)}
          onLongPress={() => step(-10)}
          disabled={value === 0}
          style={({ pressed }) => [styles.bigStepper, value === 0 && { opacity: 0.3 }, pressed && { backgroundColor: colors.surfaceStrong }]}
        >
          <Icon name="minus" size={24} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <TextInput
          accessibilityLabel={t('countOf', { label })}
          value={String(value)}
          onChangeText={(text) => onChange(Math.max(0, Number(text.replace(/\D/g, '')) || 0))}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          style={styles.bigValue}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('addOne', { label })}
          accessibilityHint={t('holdTen')}
          onPress={() => step(1)}
          onLongPress={() => step(10)}
          style={({ pressed }) => [styles.bigStepper, styles.bigStepperPlus, pressed && { opacity: 0.8 }]}
        >
          <Icon name="plus" size={26} color="#ffffff" strokeWidth={2.2} />
        </Pressable>
      </View>
      <Caption style={{ textAlign: 'center' }}>{hint}</Caption>
    </View>
  );
}

export function AttendanceCountFlow() {
  const { user } = useSession();
  const t = useT('attendance.flow');
  const tc = useT('attendance.count');
  const tTypes = useT('attendance.serviceTypes');
  const common = useT('common');
  const format = useAppFormat();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const pickBranch = can.pickBranch(user?.role);

  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);
  const [branchId, setBranchId] = useState(userBranchId(user));
  const effectiveBranchId = branchId || (branches.data?.length ? branches.data[0]._id : '');

  const serviceTypes = useApi<ServiceType[]>(effectiveBranchId || !pickBranch ? `/service-types${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}` : null);
  const [cachedTypes, setCachedTypes] = useState<ServiceType[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [today] = useState(() => new Date());
  const [date, setDate] = useState(() => new Date());
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  // Keep the last service list on the phone so counting still works with no signal.
  useEffect(() => {
    const key = serviceTypesCacheKey(effectiveBranchId);
    if (serviceTypes.data) {
      void AsyncStorage.setItem(key, JSON.stringify(serviceTypes.data));
    } else {
      void AsyncStorage.getItem(key).then((raw) => setCachedTypes(raw ? (JSON.parse(raw) as ServiceType[]) : []));
    }
  }, [serviceTypes.data, effectiveBranchId]);

  const types = useMemo(() => (serviceTypes.data ?? cachedTypes).filter((item) => item.isActive !== false), [serviceTypes.data, cachedTypes]);
  const selectedType = types.find((item) => item._id === serviceTypeId) ?? (types.length === 1 ? types[0] : undefined);

  const steps = useMemo<StepKey[]>(() => [...(pickBranch ? (['branch'] as StepKey[]) : []), 'service', 'date', ...HEADCOUNT, ...OF_THOSE, 'review'], [pickBranch]);
  const current = steps[Math.min(step, steps.length - 1)];
  const total = counts.menCount + counts.womenCount + counts.childrenCount;

  /* ---- motion: the question slides in from the side you're moving toward; the bar fills ---- */
  const [fade] = useState(() => new Animated.Value(1));
  const [slide] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(1 / steps.length));
  const busy = useRef(false);

  useEffect(() => {
    Animated.timing(progress, { toValue: (step + 1) / steps.length, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, step, steps.length]);

  function go(next: number) {
    if (busy.current || next === step) return;
    // Ignore taps while the swap is in flight; released on a timer so a stalled frame never locks the flow.
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
    }, 380);
    const direction = next > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: native }),
      Animated.timing(slide, { toValue: -28 * direction, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: native }),
    ]).start(() => {
      setStep(next);
      slide.setValue(48 * direction);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.back(1.1)), useNativeDriver: native }),
      ]).start();
    });
  }

  function next() {
    if (current === 'service' && !selectedType) {
      toast.error(tc('chooseService'));
      return;
    }
    go(Math.min(step + 1, steps.length - 1));
  }

  function back() {
    if (step === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/attendance');
      return;
    }
    go(step - 1);
  }

  /** Picking an answer moves on by itself; a short beat lets the tick land first. */
  function chooseAndAdvance(apply: () => void) {
    apply();
    setTimeout(() => go(Math.min(step + 1, steps.length - 1)), 160);
  }

  const setCount = (key: CountKey) => (value: number) => setCounts((prev) => ({ ...prev, [key]: value }));

  async function save() {
    if (!selectedType) {
      toast.error(tc('chooseService'));
      return;
    }
    if (total === 0) {
      toast.error(tc('addSomeone'));
      return;
    }
    const body = {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      serviceDate: isoDay(date),
      serviceTypeId: selectedType._id,
      entryMode: 'summary',
      personType: 'summary',
      ...counts,
      adultsCount: counts.menCount + counts.womenCount,
    };
    const scope = getApiSession().storageScope;
    const label = tc('queued', { service: selectedType.name, date: format.shortDate(date), count: total });

    setSaving(true);
    try {
      if (!online) throw new NetworkError();
      await api.post('/attendance', body);
      toast.success(tc('saved', { count: format.number(total), service: selectedType.name }));
    } catch (error) {
      if (error instanceof NetworkError) {
        await queueAttendance(label, body, scope);
        toast.info(tc('savedOffline'));
      } else {
        toast.error(errorMessage(error));
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/attendance');
  }

  /* ---- the question and body for the current step ---- */
  let question = '';
  let hint = '';
  let body: React.ReactNode = null;

  if (current === 'branch') {
    question = t('branch.question');
    hint = t('branch.hint');
    body = branches.data ? (
      <View style={styles.options}>
        {branches.data.map((branch) => (
          <OptionRow
            key={branch._id}
            label={branch.name}
            selected={effectiveBranchId === branch._id}
            onPress={() =>
              chooseAndAdvance(() => {
                setBranchId(branch._id);
                setServiceTypeId('');
              })
            }
          />
        ))}
      </View>
    ) : (
      <Loading />
    );
  } else if (current === 'service') {
    question = t('service.question');
    hint = t('service.hint');
    body = types.length ? (
      <View style={styles.options}>
        {types.map((item) => (
          <OptionRow key={item._id} label={item.name} selected={selectedType?._id === item._id} onPress={() => chooseAndAdvance(() => setServiceTypeId(item._id))} />
        ))}
      </View>
    ) : serviceTypes.loading ? (
      <Loading />
    ) : (
      <Notice tone="info" icon="info">
        {t('service.none')}
      </Notice>
    );
    if (canManageLocalServiceTypes(user?.role)) {
      body = (
        <View style={{ gap: space.md }}>
          {types.length || serviceTypes.loading ? body : <Notice tone="info" icon="info">{tTypes('empty')}</Notice>}
          <Button label={tTypes('title')} variant="secondary" onPress={() => router.push('/attendance/service-types' as Href)} />
        </View>
      );
    }
  } else if (current === 'date') {
    question = t('date.question');
    hint = t('date.hint');
    const yesterday = daysBefore(today, 1);
    const isToday = sameDay(date, today);
    const isYesterday = sameDay(date, yesterday);
    body = (
      <View style={styles.options}>
        <OptionRow label={t('date.today')} hint={format.longDate(today)} selected={isToday} onPress={() => chooseAndAdvance(() => setDate(new Date(today)))} />
        <OptionRow label={t('date.yesterday')} hint={format.longDate(yesterday)} selected={isYesterday} onPress={() => chooseAndAdvance(() => setDate(yesterday))} />
        <View style={{ gap: space.xs, marginTop: space.sm }}>
          <Caption>{t('date.other')}</Caption>
          <DateStepper value={date} onChange={setDate} label={format.longDate(date)} max={today} />
        </View>
      </View>
    );
  } else if (current === 'review') {
    question = t('review.question');
    hint = t('review.hint');
    const rows: { label: string; value: string }[] = [
      { label: common('fields.service'), value: selectedType?.name ?? '' },
      { label: common('fields.date'), value: format.longDate(date) },
      ...(pickBranch ? [{ label: common('fields.branch'), value: branches.data?.find((b) => b._id === effectiveBranchId)?.name ?? '' }] : []),
      ...[...HEADCOUNT, ...OF_THOSE].map((key) => ({ label: tc(`counters.${key}`), value: format.number(counts[key]) })),
    ];
    body = (
      <View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('review.total')}</Text>
          <Text style={styles.totalValue}>{format.number(total)}</Text>
        </View>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.reviewRow, index > 0 && styles.reviewDivider]}>
            <Text style={[type.body, { flex: 1, color: colors.muted }]} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={[type.label, { fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    );
  } else {
    const key = current;
    question = t(`${FLOW_KEY[key]}.question`);
    hint = t(`${FLOW_KEY[key]}.hint`);
    body = (
      <View style={{ gap: space.xl }}>
        <BigCounter label={tc(`counters.${key}`)} value={counts[key]} onChange={setCount(key)} hint={tc('holdTen')} />
        {HEADCOUNT.includes(key) && total > 0 ? (
          <View style={styles.runningTotal}>
            <Icon name="units" size={14} color={colors.muted} />
            <Text style={styles.runningTotalText}>{t('runningTotal', { count: format.number(total) })}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const isReview = current === 'review';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <Stack.Screen options={{ title: t('title') }} />

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.stepOf}>{t('stepOf', { step: step + 1, total: steps.length })}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }], gap: space.xl }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.question}>{question}</Text>
            <Caption numberOfLines={3}>{hint}</Caption>
          </View>
          {body}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {step > 0 ? <Button label={common('actions.back')} variant="secondary" size="lg" onPress={back} style={{ flex: 1 }} /> : null}
        {isReview ? (
          <Button
            label={online ? tc('saveCount') : tc('saveOffline')}
            icon={online ? 'check' : 'cloudOff'}
            size="lg"
            loading={saving}
            disabled={total === 0}
            onPress={() => void save()}
            style={{ flex: 2 }}
          />
        ) : (
          <Button label={common('actions.next')} icon="arrowRight" size="lg" onPress={next} style={{ flex: 2 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  progressWrap: { paddingHorizontal: space.page, paddingTop: space.sm, gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: colors.flame },
  stepOf: { ...type.micro, textTransform: 'uppercase' },
  content: { paddingHorizontal: space.page, paddingTop: space.xl, paddingBottom: space.xxl },
  question: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, color: colors.ink, letterSpacing: -0.4 },
  options: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    backgroundColor: colors.page,
  },
  optionSelected: { borderColor: colors.ink, backgroundColor: colors.surface },
  optionMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  optionMarkSelected: { backgroundColor: colors.flame, borderColor: colors.flame },
  bigCounter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingVertical: space.lg },
  bigStepper: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  bigStepperPlus: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.ink, borderColor: colors.ink },
  bigValue: {
    minWidth: 110,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 64,
    lineHeight: 72,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    paddingVertical: 0,
  },
  runningTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  runningTotalText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  totalCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, gap: 2 },
  totalLabel: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6 },
  totalValue: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 46, color: '#ffffff', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  reviewDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.page, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, backgroundColor: colors.page },
});
