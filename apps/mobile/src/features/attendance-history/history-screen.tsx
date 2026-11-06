import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { StatGrid, StatTile } from '@/components/kit';
import { Button, Caption, EmptyState, ErrorState, ListRow, Loading, Screen } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { BranchFilter, daysAgo, periodQuery, RangeChips, startOfWeek } from '@/features/finance/shared';
import { query } from '@/lib/api';
import { branchName, isoDay, toLocalDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { peopleCount, serviceLabel, type AttendanceSummaryRecord } from './types';

type Range = 'week' | 'days30' | 'days90';
const RANGES: Range[] = ['week', 'days30', 'days90'];

function rangeStart(range: Range, today: Date) {
  if (range === 'week') return startOfWeek(today);
  return daysAgo(today, range === 'days30' ? 30 : 90);
}

type DaySection = { day: string; date: Date; data: AttendanceSummaryRecord[] };

/** The website's service summaries, grouped by service day, with the period totals on top. */
export function AttendanceHistoryScreen() {
  const t = useT('attendanceHistory');
  const format = useAppFormat();
  const { user } = useSession();
  const role = user?.role;
  const allowed = can.attendance(role);
  const pickBranch = can.pickBranch(role);

  const [range, setRange] = useState<Range>('days30');
  const [branchId, setBranchId] = useState('');
  const [today] = useState(() => new Date());

  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const list = useApi<AttendanceSummaryRecord[]>(allowed ? `/attendance${query({ entryMode: 'summary', branchId, ...periodQuery(rangeStart(range, today), today) })}` : null);

  const records = useMemo(() => (list.data ?? []).filter((record) => record.entryMode === 'summary' || !record.entryMode), [list.data]);

  const totals = useMemo(
    () =>
      records.reduce(
        (sum, record) => ({
          people: sum.people + peopleCount(record),
          adults: sum.adults + ((record.adultsCount ?? 0) || (record.menCount ?? 0) + (record.womenCount ?? 0)),
          children: sum.children + (record.childrenCount ?? 0),
          firstTimers: sum.firstTimers + (record.firstTimersCount ?? 0),
          newConverts: sum.newConverts + (record.newConvertsCount ?? 0),
        }),
        { people: 0, adults: 0, children: 0, firstTimers: 0, newConverts: 0 },
      ),
    [records],
  );

  const sections = useMemo<DaySection[]>(() => {
    const byDay = new Map<string, DaySection>();
    for (const record of records) {
      const date = toLocalDate(record.serviceDate);
      const day = isoDay(date);
      const section = byDay.get(day) ?? { day, date, data: [] };
      section.data.push(record);
      byDay.set(day, section);
    }
    return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [records]);

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={t('noAccess')} />
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.controls}>
        <View style={{ flex: 1 }}>
          <RangeChips options={RANGES.map((value) => ({ value, label: t(`range.${value}`) }))} value={range} onChange={setRange} />
        </View>
        {can.recordAttendance(role) ? <Button label={t('countNow')} size="sm" icon="plus" onPress={() => router.push('/attendance')} /> : null}
      </View>
      {pickBranch ? <BranchFilter label={t('branch.label')} allLabel={t('branch.all')} branches={branches.data ?? []} value={branchId} onChange={setBranchId} /> : null}
      {list.data ? (
        <StatGrid>
          <StatTile label={t('tiles.people')} value={format.number(totals.people)} hint={t('tiles.services', { count: records.length })} />
          <StatTile label={t('tiles.firstTimers')} value={format.number(totals.firstTimers)} tone={totals.firstTimers ? 'flame' : 'neutral'} />
          <StatTile label={t('tiles.adults')} value={format.number(totals.adults)} />
          <StatTile label={t('tiles.children')} value={format.number(totals.children)} />
        </StatGrid>
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('title') }} />
      <SectionList<AttendanceSummaryRecord, DaySection>
        sections={list.loading || (list.error && !list.data) ? [] : sections}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} tintColor={colors.flame} colors={[colors.flame]} />}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{format.shortDate(section.date)}</Text>
            <Caption>{format.date(section.date, { weekday: 'long', day: 'numeric', month: 'long' })}</Caption>
          </View>
        )}
        renderItem={({ item, index }) => (
          <ListRow
            divider={index > 0}
            title={serviceLabel(item)}
            subtitle={[pickBranch ? branchName(item.branchId) : '', item.firstTimersCount ? t('row.firstTimers', { count: item.firstTimersCount }) : ''].filter(Boolean).join(' · ')}
            right={<Text style={styles.count}>{format.number(peopleCount(item))}</Text>}
            onPress={() => router.push(`/attendance-history/${item._id}` as Href)}
          />
        )}
        ListEmptyComponent={
          list.loading ? (
            <Loading />
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={() => void list.refresh()} />
          ) : (
            <EmptyState icon="attendance" title={t('empty.title')} body={t('empty.body')} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.page, paddingBottom: space.xxl },
  header: { paddingTop: space.sm, paddingBottom: space.xs, gap: space.lg },
  controls: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, marginTop: space.lg, marginBottom: 2 },
  sectionTitle: { ...type.micro, textTransform: 'uppercase' },
  count: { ...type.label, fontVariant: ['tabular-nums'] },
});
