import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyValue, StatGrid, StatTile } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, EmptyState, ErrorState, Loading, Screen, Section } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { branchName } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { Counter } from './counter';
import { EDITABLE_COUNTS, OF_THOSE_COUNTS, peopleCount, serviceLabel, type AttendanceSummaryRecord, type CountKey } from './types';

type Counts = Record<CountKey, number>;

const COUNT_LABELS: Record<CountKey, string> = {
  menCount: 'men',
  womenCount: 'women',
  childrenCount: 'children',
  adultsCount: 'adults',
  firstTimersCount: 'firstTimers',
  newConvertsCount: 'newConverts',
  holySpiritBaptismCount: 'holySpirit',
};

function countsOf(record: AttendanceSummaryRecord): Counts {
  return {
    menCount: record.menCount ?? 0,
    womenCount: record.womenCount ?? 0,
    childrenCount: record.childrenCount ?? 0,
    adultsCount: record.adultsCount ?? 0,
    firstTimersCount: record.firstTimersCount ?? 0,
    newConvertsCount: record.newConvertsCount ?? 0,
    holySpiritBaptismCount: record.holySpiritBaptismCount ?? 0,
  };
}

/** One service summary: every count, where and when it was taken, and an inline correction for roles the API lets edit. */
export function AttendanceEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('attendanceHistory.detail');
  const tRoot = useT('attendanceHistory');
  const tc = useT('common.actions');
  const format = useAppFormat();
  const { user } = useSession();
  const role = user?.role;
  const allowed = can.attendance(role);
  // The website hides the edit from follow-up; the API's PATCH roles are everyone else who can see attendance.
  const canEdit = allowed && role !== 'follow_up';

  const record = useApi<AttendanceSummaryRecord>(allowed && id ? `/attendance/${id}` : null);
  const [draft, setDraft] = useState<Counts | null>(null);
  const [saving, setSaving] = useState(false);

  const item = record.data;
  const title = item ? serviceLabel(item) || t('title') : t('title');

  async function save() {
    if (!item || !draft) return;
    const body = { ...draft, adultsCount: draft.menCount + draft.womenCount };
    setSaving(true);
    try {
      await api.patch(`/attendance/${item._id}`, body);
      record.setData((current) => current && { ...current, ...body });
      toast.success(t('saved'));
      setDraft(null);
      void record.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const counts = item ? (draft ?? countsOf(item)) : null;
  const draftTotal = draft ? draft.menCount + draft.womenCount + draft.childrenCount : 0;

  return (
    <Screen
      safeTop={false}
      refreshing={record.refreshing}
      onRefresh={() => void record.refresh()}
      footer={
        draft ? (
          <View style={styles.footer}>
            <View style={{ minWidth: 64 }}>
              <Text style={type.micro}>{t('total').toUpperCase()}</Text>
              <Text style={type.number}>{format.number(draftTotal)}</Text>
            </View>
            <Button label={t('save')} icon="check" size="lg" loading={saving} style={{ flex: 1 }} onPress={() => void save()} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title }} />
      {!allowed ? <EmptyState icon="lock" title={tRoot('noAccess')} /> : null}
      {record.loading ? <Loading /> : null}
      {record.error && !item ? <ErrorState message={record.error} onRetry={() => void record.refresh()} /> : null}

      {item && counts ? (
        <>
          <View style={styles.top}>
            <Text style={styles.total}>{format.number(draft ? draftTotal : peopleCount(item))}</Text>
            <Text style={type.small}>{[t('total'), format.date(item.serviceDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })].join(' · ')}</Text>
          </View>

          {draft ? (
            <>
              <View>
                <Section title={t('headcount')} />
                {EDITABLE_COUNTS.map((key, index) => (
                  <Counter key={key} label={t(COUNT_LABELS[key])} value={draft[key]} divider={index > 0} onChange={(next) => setDraft((current) => current && { ...current, [key]: next })} />
                ))}
              </View>
              <View>
                <Section title={t('ofThose')} />
                {OF_THOSE_COUNTS.map((key, index) => (
                  <Counter key={key} label={t(COUNT_LABELS[key])} value={draft[key]} divider={index > 0} onChange={(next) => setDraft((current) => current && { ...current, [key]: next })} />
                ))}
              </View>
              <Button label={tc('cancel')} variant="ghost" disabled={saving} onPress={() => setDraft(null)} />
            </>
          ) : (
            <>
              <View>
                <Section title={t('counts')} />
                <StatGrid>
                  {(Object.keys(COUNT_LABELS) as CountKey[]).map((key) => (
                    <StatTile key={key} label={t(COUNT_LABELS[key])} value={format.number(counts[key])} tone={key === 'firstTimersCount' && counts[key] ? 'flame' : 'neutral'} />
                  ))}
                </StatGrid>
              </View>

              <View>
                <Section title={t('service')} />
                <KeyValue
                  rows={[
                    { label: t('service'), value: serviceLabel(item) },
                    { label: t('date'), value: format.date(item.serviceDate) },
                    { label: t('branch'), value: branchName(item.branchId) },
                    { label: t('recordedBy'), value: typeof item.createdBy === 'object' ? format.fullName(item.createdBy) : undefined },
                    { label: t('recordedAt'), value: item.createdAt ? format.dateTime(item.createdAt) : undefined },
                    { label: t('updatedAt'), value: item.updatedAt && item.updatedAt !== item.createdAt ? format.dateTime(item.updatedAt) : undefined },
                  ]}
                />
              </View>

              {canEdit ? <Button label={t('edit')} variant="secondary" icon="edit" onPress={() => setDraft(countsOf(item))} /> : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { gap: 2 },
  total: { ...type.display, fontSize: 34, lineHeight: 40, color: colors.ink, fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
});
