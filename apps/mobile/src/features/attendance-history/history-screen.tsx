import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { SheetPicker, StatGrid, StatTile } from '@/components/kit';
import { Button, Field, Caption, EmptyState, ErrorState, ListRow, Loading, Screen, ScreenHeader, tap } from '@/components/ui';
import { Reveal } from '@/components/motion';
import { colors, space, type } from '@/constants/theme';
import { OutboxNotices } from '@/features/attendance/outbox';
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

type Range = 'week' | 'days30' | 'days90' | 'month' | 'year' | 'custom';
const RANGES: Range[] = ['week', 'days30', 'days90'];

function rangeStart(range: Range, today: Date) {
  if (range === 'week') return startOfWeek(today);
  return daysAgo(today, range === 'days30' ? 30 : 90);
}

type DaySection = { day: string; date: Date; data: AttendanceSummaryRecord[] };

const NEW_COUNT = '/attendance/new' as Href;

/**
 * The website's service summaries, grouped by service day, with the period totals on top.
 * As the Attendance tab (`asTab`) it carries its own title and a + that opens the counter.
 */
export function AttendanceHistoryScreen({ asTab = false }: { asTab?: boolean }) {
  const t = useT('attendanceHistory');
  const tTab = useT('attendance.list');
  const format = useAppFormat();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const role = user?.role;
  const allowed = can.attendance(role);
  const pickBranch = can.pickBranch(role);
  const canCount = can.recordAttendance(role);

  const [range, setRange] = useState<Range>('days30');
  const [branchId, setBranchId] = useState('');
  const [today] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [month, setMonth] = useState(String(today.getMonth()));
  const [year, setYear] = useState(String(today.getFullYear()));
  const [from, setFrom] = useState(isoDay(startOfWeek(today)));
  const [to, setTo] = useState(isoDay(today));
  const [weekday, setWeekday] = useState('all');
  const [service, setService] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const start =
    range === 'month'
      ? new Date(Number(year), Number(month), 1)
      : range === 'year'
        ? new Date(Number(year), 0, 1)
        : range === 'custom'
          ? new Date(from + 'T00:00:00')
          : rangeStart(range, today);
  const end =
    range === 'month' ? new Date(Number(year), Number(month) + 1, 0) : range === 'year' ? new Date(Number(year), 11, 31) : range === 'custom' ? new Date(to + 'T00:00:00') : today;
  const validDates = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start <= end && (!(range==='month'||range==='year') || /^\d{4}$/.test(year)) && (range!=='custom' || (isoDay(start)===from && isoDay(end)===to));
  const serviceOptions = useApi<{ _id: string; key: string; name: string }[]>(allowed ? '/service-types' : null);

  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const list = useApi<AttendanceSummaryRecord[]>(allowed && validDates ? `/attendance${query({ entryMode: 'summary', branchId, ...periodQuery(start, end) })}` : null);

  const startDay = validDates ? isoDay(start) : '';
  const endDay = validDates ? isoDay(end) : '';
  const records = useMemo(
    () =>
      (validDates ? (list.data ?? []) : [])
        .filter(
          (record) =>
            isoDay(toLocalDate(record.serviceDate)) >= startDay &&
            isoDay(toLocalDate(record.serviceDate)) <= endDay &&
            (!branchId || (typeof record.branchId === 'string' ? record.branchId : record.branchId?._id) === branchId) &&
            (record.entryMode === 'summary' || !record.entryMode) &&
            (weekday === 'all' || toLocalDate(record.serviceDate).getDay() === Number(weekday)) &&
            (!service || record.serviceType === service) &&
            serviceLabel(record).toLowerCase().includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'highest'
            ? peopleCount(b) - peopleCount(a)
            : sort === 'lowest'
              ? peopleCount(a) - peopleCount(b)
              : (sort === 'oldest' ? 1 : -1) * a.serviceDate.localeCompare(b.serviceDate),
        ),
    [list.data, weekday, service, search, sort, validDates, branchId, startDay, endDay],
  );
  const sundayRows = records.filter((record) => toLocalDate(record.serviceDate).getDay() === 0);
  const sundayDays = new Set(sundayRows.map((record) => isoDay(toLocalDate(record.serviceDate)))).size;
  const sundayAverage = sundayDays ? sundayRows.reduce((sum, record) => sum + peopleCount(record), 0) / sundayDays : undefined;

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
      <Screen safeTop={asTab}>
        {asTab ? <ScreenHeader title={t('title')} /> : <Stack.Screen options={{ title: t('title') }} />}
        <EmptyState icon="lock" title={t('noAccess')} />
      </Screen>
    );
  }

  const header = (
    <View style={[styles.header, asTab && { paddingTop: insets.top + space.md }]}>
      {asTab ? (
        <ScreenHeader
          title={t('title')}
          subtitle={canCount ? tTab('subtitle') : undefined}
          right={
            canCount ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tTab('newCount')}
                hitSlop={8}
                onPress={() => {
                  tap();
                  router.push(NEW_COUNT);
                }}
                style={({ pressed }) => [styles.add, pressed && { opacity: 0.75 }]}
              >
                <Icon name="plus" size={20} color="#ffffff" strokeWidth={2.2} />
              </Pressable>
            ) : null
          }
        />
      ) : null}
      {canCount ? <OutboxNotices onSent={() => void list.reload()} /> : null}
      <View style={styles.controls}>
        <View style={{ flex: 1 }}>
          <RangeChips options={RANGES.map((value) => ({ value, label: t(`range.${value}`) }))} value={range} onChange={setRange} />
        </View>
        {canCount && !asTab ? <Button label={t('countNow')} size="sm" icon="plus" onPress={() => router.push(NEW_COUNT)} /> : null}
      </View>
      <Button icon="filter" label={t('advanced.filters')} variant="secondary" size="sm" onPress={() => setFiltersOpen(!filtersOpen)} />
      {filtersOpen ? (
        <View style={{ gap: space.md }}>
          <SheetPicker
            label={t('advanced.filters')}
            value={range}
            options={[
              ...RANGES.map((value) => ({ value, label: t(`range.${value}`) })),
              ...(['month', 'year', 'custom'] as const).map((value) => ({ value, label: t(`advanced.${value}`) })),
            ]}
            onChange={setRange}
          />
          {range === 'month' ? (
            <SheetPicker
              label={t('advanced.month')}
              value={month}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: format.date(new Date(2026, i, 1), { month: 'long' }) }))}
              onChange={setMonth}
            />
          ) : null}
          {range === 'month' || range === 'year' ? <Field label={t('advanced.year')} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} /> : null}
          {range === 'custom' ? (
            <>
              <Field label={t('advanced.from')} value={from} onChangeText={setFrom} />
              <Field label={t('advanced.to')} value={to} onChangeText={setTo} />
            </>
          ) : null}
          <SheetPicker
            label={t('advanced.weekday')}
            value={weekday}
            options={[
              { value: 'all', label: t('advanced.allDays') },
              ...Array.from({ length: 7 }, (_, day) => ({ value: String(day), label: format.date(new Date(2026, 10, 1 + day), { weekday: 'long' }) })),
            ]}
            onChange={setWeekday}
          />
          <SheetPicker
            label={t('advanced.service')}
            value={service}
            options={[{ value: '', label: t('advanced.allServices') }, ...(serviceOptions.data ?? []).map((item) => ({ value: item.key, label: item.name }))]}
            onChange={setService}
          />
          <Field label={t('advanced.search')} value={search} onChangeText={setSearch} />
          <SheetPicker
            label={t('advanced.sort')}
            value={sort}
            options={['newest', 'oldest', 'highest', 'lowest'].map((value) => ({ value, label: t(`advanced.${value}`) }))}
            onChange={setSort}
          />
          <Button
            label={t('advanced.reset')}
            variant="secondary"
            onPress={() => {
              setRange('days30');
              setWeekday('all');
              setService('');
              setSearch('');
              setSort('newest');
              setBranchId('');
            }}
          />
        </View>
      ) : null}
      {!validDates ? <Caption>{t('advanced.invalid')}</Caption> : null}
      {filtersOpen && pickBranch ? (
        <BranchFilter label={t('branch.label')} allLabel={t('branch.all')} branches={branches.data ?? []} value={branchId} onChange={setBranchId} />
      ) : null}
      <Caption>{t('advanced.averageHint')}</Caption>
      {list.data ? (
        <StatGrid>
          <StatTile label={t('tiles.people')} value={format.number(totals.people)} hint={t('tiles.services', { count: records.length })} />
          <StatTile label={t('tiles.firstTimers')} value={format.number(totals.firstTimers)} tone={totals.firstTimers ? 'flame' : 'neutral'} />
          <StatTile label={t('tiles.adults')} value={format.number(totals.adults)} />
          <StatTile label={t('tiles.children')} value={format.number(totals.children)} />
          <StatTile label={t('advanced.average')} value={records.length ? format.number(totals.people / records.length, { maximumFractionDigits: 1 }) : '—'} />
          <StatTile
            label={t('advanced.sundayAverage')}
            value={sundayAverage === undefined ? '—' : format.number(sundayAverage, { maximumFractionDigits: 1 })}
            hint={t('advanced.sundayCount') + ': ' + sundayDays}
          />
        </StatGrid>
      ) : null}
    </View>
  );

  return (
    <View style={styles.page}>
      {asTab ? null : <Stack.Screen options={{ title: t('title') }} />}
      <SectionList<AttendanceSummaryRecord, DaySection>
        sections={list.loading || (list.error && !list.data) ? [] : sections}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} tintColor={colors.flame} colors={[colors.flame]} />}
        ListHeaderComponent={<Reveal>{header}</Reveal>}
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
            subtitle={[pickBranch ? branchName(item.branchId) : '', item.firstTimersCount ? t('row.firstTimers', { count: item.firstTimersCount }) : '']
              .filter(Boolean)
              .join(' · ')}
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
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, marginTop: space.lg, marginBottom: 2 },
  sectionTitle: { ...type.micro, textTransform: 'uppercase' },
  count: { ...type.label, fontVariant: ['tabular-nums'] },
});
