import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, ListRow, Notice, Screen, ScreenHeader, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { api, errorMessage, NetworkError } from '@/lib/api';
import { branchName, formatNumber, isoDay, shortDate } from '@/lib/format';
import { discardQueued, flushAttendance, queueAttendance, useAttendanceOutbox, useOnline } from '@/lib/offline-queue';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { AttendanceItem, BranchSummary, ServiceType } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type CountKey = 'menCount' | 'womenCount' | 'childrenCount' | 'firstTimersCount' | 'newConvertsCount' | 'holySpiritBaptismCount';

const HEADCOUNT: { key: CountKey; label: string }[] = [
  { key: 'menCount', label: 'Men' },
  { key: 'womenCount', label: 'Women' },
  { key: 'childrenCount', label: 'Children' },
];

/** Already part of the headcount above; recorded separately for reports. */
const OF_THOSE: { key: CountKey; label: string }[] = [
  { key: 'firstTimersCount', label: 'First-timers' },
  { key: 'newConvertsCount', label: 'New converts' },
  { key: 'holySpiritBaptismCount', label: 'Holy Spirit baptism' },
];

const EMPTY: Record<CountKey, number> = {
  menCount: 0,
  womenCount: 0,
  childrenCount: 0,
  firstTimersCount: 0,
  newConvertsCount: 0,
  holySpiritBaptismCount: 0,
};

const serviceTypesCacheKey = (branchId: string) => `chuflow.serviceTypes.${branchId || 'all'}`;

function Counter({
  label,
  value,
  onStep,
  onSet,
  divider,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
  onSet: (value: number) => void;
  divider: boolean;
}) {
  // Steps go through a functional update so fast taps at the door never drop a count.
  const step = (delta: number) => {
    tap();
    onStep(delta);
  };
  return (
    <View style={[styles.counter, divider && styles.divider]}>
      <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove one from ${label}`}
        onPress={() => step(-1)}
        onLongPress={() => step(-10)}
        disabled={value === 0}
        style={({ pressed }) => [styles.stepper, value === 0 && { opacity: 0.35 }, pressed && { backgroundColor: colors.surfaceStrong }]}
        hitSlop={6}
      >
        <Icon name="minus" size={16} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <TextInput
        accessibilityLabel={`${label} count`}
        value={String(value)}
        onChangeText={(text) => onSet(Math.max(0, Number(text.replace(/\D/g, '')) || 0))}
        keyboardType="number-pad"
        selectTextOnFocus
        style={styles.counterValue}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one to ${label}`}
        accessibilityHint="Hold to add ten"
        onPress={() => step(1)}
        onLongPress={() => step(10)}
        style={({ pressed }) => [styles.stepper, styles.stepperPlus, pressed && { opacity: 0.8 }]}
        hitSlop={6}
      >
        <Icon name="plus" size={16} color="#ffffff" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export default function AttendanceScreen() {
  const { user } = useSession();
  const online = useOnline();
  const outbox = useAttendanceOutbox();
  const pickBranch = can.pickBranch(user?.role);
  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);
  const [branchId, setBranchId] = useState(userBranchId(user));
  const effectiveBranchId = branchId || (branches.data?.length ? branches.data[0]._id : '');

  const serviceTypes = useApi<ServiceType[]>(effectiveBranchId || !pickBranch ? `/service-types${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}` : null);
  const [cachedTypes, setCachedTypes] = useState<ServiceType[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [dayOffset, setDayOffset] = useState(0);
  const [counts, setCounts] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [today] = useState(() => new Date());
  const fromTwoWeeks = isoDay(new Date(today.getTime() - 14 * 86_400_000));
  const recent = useApi<AttendanceItem[]>(`/attendance?entryMode=summary&dateFrom=${fromTwoWeeks}`);

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
  const selectedType = types.find((item) => item._id === serviceTypeId) ?? types[0];

  const serviceDate = new Date(today);
  serviceDate.setDate(today.getDate() - dayOffset);
  const total = counts.menCount + counts.womenCount + counts.childrenCount;

  const stepper = (key: CountKey) => ({
    onStep: (delta: number) => setCounts((current) => ({ ...current, [key]: Math.max(0, current[key] + delta) })),
    onSet: (value: number) => setCounts((current) => ({ ...current, [key]: value })),
  });

  async function save() {
    if (!selectedType) {
      toast.error('Choose a service first.');
      return;
    }
    if (total === 0) {
      toast.error('Add at least one person.');
      return;
    }

    const body = {
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      serviceDate: isoDay(serviceDate),
      serviceTypeId: selectedType._id,
      entryMode: 'summary',
      personType: 'summary',
      ...counts,
      adultsCount: counts.menCount + counts.womenCount,
    };
    const label = `${selectedType.name} · ${shortDate(serviceDate)} · ${formatNumber(total)} people`;

    setSaving(true);
    try {
      if (!online) throw new NetworkError();
      await api.post('/attendance', body);
      toast.success(`Saved: ${formatNumber(total)} at ${selectedType.name}`);
      setCounts(EMPTY);
      void recent.reload();
    } catch (error) {
      if (error instanceof NetworkError) {
        await queueAttendance(label, body);
        toast.info("Saved on this phone. It'll send when you're back online.");
        setCounts(EMPTY);
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  const waiting = outbox.filter((item) => !item.error);
  const failed = outbox.filter((item) => item.error);

  return (
    <Screen
      refreshing={recent.refreshing}
      onRefresh={() => {
        void recent.refresh();
        void serviceTypes.refresh();
      }}
      footer={
        <View style={styles.footerRow}>
          <View style={{ minWidth: 64 }}>
            <Text style={type.micro}>TOTAL</Text>
            <Text style={type.number}>{formatNumber(total)}</Text>
          </View>
          <Button
            label={online ? 'Save count' : 'Save offline'}
            icon={online ? 'check' : 'cloudOff'}
            size="lg"
            loading={saving}
            disabled={total === 0}
            onPress={() => void save()}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <ScreenHeader title="Attendance" subtitle="Count as people come in. With no signal it saves on your phone." />

      {!online ? (
        <Notice tone="warning" icon="cloudOff">
          You&apos;re offline. Counts are kept on this phone.
        </Notice>
      ) : null}

      {waiting.length ? (
        <View style={styles.outbox}>
          <Icon name="clock" size={15} color={colors.warning} />
          <Text style={styles.outboxText} numberOfLines={2}>
            {waiting.length} {waiting.length === 1 ? 'count' : 'counts'} waiting to send
          </Text>
          <Button
            label="Send now"
            size="sm"
            variant="secondary"
            disabled={!online}
            onPress={() =>
              void flushAttendance().then((sent) => {
                if (sent) {
                  toast.success(`${sent} sent`);
                  void recent.reload();
                }
              })
            }
          />
        </View>
      ) : null}

      {failed.map((item) => (
        <View key={item.id} style={styles.failed}>
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: colors.danger }]} numberOfLines={1}>
              Couldn&apos;t send {item.label}
            </Text>
            <Caption numberOfLines={2}>{item.error}</Caption>
          </View>
          <Button label="Remove" size="sm" variant="secondary" onPress={() => void discardQueued(item.id)} />
        </View>
      ))}

      {pickBranch && (branches.data?.length ?? 0) > 1 ? (
        <View style={styles.group}>
          <Section title="Branch" />
          <View style={styles.chips}>
            {branches.data!.map((branch) => (
              <Chip
                key={branch._id}
                label={branch.name}
                selected={effectiveBranchId === branch._id}
                onPress={() => {
                  setBranchId(branch._id);
                  setServiceTypeId('');
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <Section title="Service" />
        {types.length ? (
          <View style={styles.chips}>
            {types.map((item) => (
              <Chip key={item._id} label={item.name} selected={selectedType?._id === item._id} onPress={() => setServiceTypeId(item._id)} />
            ))}
          </View>
        ) : (
          <Caption>{serviceTypes.loading ? 'Loading services…' : 'No services set up for this branch yet. Add them on the website.'}</Caption>
        )}
      </View>

      <View style={styles.dateRow}>
        <Pressable accessibilityLabel="Previous day" onPress={() => setDayOffset((value) => value + 1)} style={styles.dateButton} hitSlop={8}>
          <Icon name="chevronLeft" size={16} color={colors.ink} />
        </Pressable>
        <Text style={[type.label, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {shortDate(serviceDate)}
          <Text style={type.small}>{`  ·  ${serviceDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`}</Text>
        </Text>
        <Pressable
          accessibilityLabel="Next day"
          disabled={dayOffset === 0}
          onPress={() => setDayOffset((value) => Math.max(0, value - 1))}
          style={[styles.dateButton, dayOffset === 0 && { opacity: 0.3 }]}
          hitSlop={8}
        >
          <Icon name="chevronRight" size={16} color={colors.ink} />
        </Pressable>
      </View>

      <View>
        <Section title="Headcount" />
        {HEADCOUNT.map((counter, index) => (
          <Counter key={counter.key} label={counter.label} value={counts[counter.key]} divider={index > 0} {...stepper(counter.key)} />
        ))}
      </View>

      <View>
        <Section title="Of those" />
        {OF_THOSE.map((counter, index) => (
          <Counter key={counter.key} label={counter.label} value={counts[counter.key]} divider={index > 0} {...stepper(counter.key)} />
        ))}
      </View>

      {recent.data?.length ? (
        <View>
          <Section title="Recently recorded" />
          {recent.data.slice(0, 6).map((item, index) => {
            const people =
              (item.adultsCount ?? 0) + (item.childrenCount ?? 0) || (item.menCount ?? 0) + (item.womenCount ?? 0) + (item.childrenCount ?? 0);
            return (
              <ListRow
                key={item._id}
                divider={index > 0}
                title={item.serviceTypeId?.name || item.serviceTypeLabel || item.serviceName || 'Service'}
                subtitle={[shortDate(item.serviceDate), typeof item.branchId === 'object' ? branchName(item.branchId) : ''].filter(Boolean).join(' · ')}
                right={<Text style={[type.label, { fontVariant: ['tabular-nums'] }]}>{formatNumber(people)}</Text>}
              />
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  outbox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.warningBg, borderRadius: radius.md, paddingVertical: 8, paddingLeft: space.md, paddingRight: 8 },
  outboxText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warning },
  failed: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    padding: 4,
  },
  dateButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  stepper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperPlus: { backgroundColor: colors.ink, borderColor: colors.ink },
  counterValue: {
    width: 52,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
});
