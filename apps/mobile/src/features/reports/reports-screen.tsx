import { router, Stack, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SearchBar, SheetPicker, StatGrid, StatTile } from '@/components/kit';
import { Button, Caption, EmptyState, ErrorState, ListRow, Loading, Screen, Section, Segmented } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { Icon } from '@/components/icon';
import { BarRow } from '@/features/home/bars';
import { DaysRow } from '@/features/home/days-row';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { query } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { isoDay } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import type { ReportGroupTotal, ReportsSummary, WeeklyReportListResponse } from './types';

type ReportView = 'attendance' | 'people' | 'branches';
const RECENT_SERVICE_DAYS = 6;

const DAY_OPTIONS = [7, 14, 30, 60, 90] as const;
const ALL = 'all';
const SEARCH_FROM = 8;

export function ReportsScreen() {
  const { user } = useSession();
  const t = useT('reports');
  const tc = useT('common');
  const format = useAppFormat();
  const role = user?.role;
  const allowed = can.reports(role);
  const pickBranch = can.pickBranch(role);
  const [days, setDays] = useState(() => user?.preferences?.defaultReportDays ?? 30);
  const [branch, setBranch] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ReportView>('attendance');
  const [showAllDays, setShowAllDays] = useState(false);
  const branchId = branch === ALL ? undefined : branch;

  const summary = useApi<ReportsSummary>(allowed ? `/reports/summary${query({ days, branchId })}` : null);
  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - days);
    return { dateFrom: isoDay(from), dateTo: isoDay(to) };
  }, [days]);
  const comparison = useApi<WeeklyReportListResponse>(allowed && pickBranch && view === 'branches' ? `/intake-templates/weekly-reports${query({ ...range, branchId })}` : null);

  const rows = useMemo(() => {
    const all = [...(comparison.data?.branchTotals ?? [])].sort((a, b) => a.label.localeCompare(b.label));
    const q = search.trim().toLowerCase();
    return q ? all.filter((row) => `${row.label} ${row.district ?? ''}`.toLowerCase().includes(q)) : all;
  }, [comparison.data, search]);

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={t('locked.title')} body={t('locked.body')} />
      </Screen>
    );
  }

  const data = summary.data;
  const totals = data?.totals;
  const serviceDays = (data?.trends ?? [])
    .filter((day) => day.hasAttendanceRecord ?? (day.attendance > 0 || day.firstTimers > 0 || day.newConverts > 0))
    .reverse();
  const visibleDays = showAllDays ? serviceDays : serviceDays.slice(0, RECENT_SERVICE_DAYS);
  const maxAttendance = Math.max(1, ...serviceDays.map((day) => day.attendance));
  const visibleView = !pickBranch && view === 'branches' ? 'attendance' : view;
  const tabs: { value: ReportView; label: string }[] = [
    { value: 'attendance', label: t('views.attendance') },
    { value: 'people', label: t('views.people') },
  ];
  if (pickBranch) tabs.push({ value: 'branches', label: t('views.branches') });
  const maxFollowUp = Math.max(1, ...(data?.followUpBreakdown.map((item) => item.total) ?? []));
  const maxService = Math.max(1, ...(data?.serviceMix.map((item) => item.totalPeople) ?? []));
  const signed = (value: number) => (value > 0 ? `+${format.number(value)}` : format.number(value));

  return (
    <Screen
      safeTop={false}
      refreshing={summary.refreshing}
      onRefresh={() => {
        void summary.refresh();
        void comparison.reload();
      }}
      contentStyle={{ gap: space.xl }}
    >
      <Stack.Screen options={{ title: t('title') }} />
      <View style={{ gap: space.md }}>
        <ListRow
          title={t('weekly.title')}
          left={<View style={styles.shortcutIcon}><Icon name="reports" size={18} color={colors.flame} /></View>}
          onPress={() => router.push('/weekly-reports' as Href)}
        />
        <DaysRow
          title={tc('time.lastNDays', { count: days })}
          value={days}
          options={DAY_OPTIONS}
          onChange={(nextDays) => { setDays(nextDays); setShowAllDays(false); }}
          label={(count) => t('days', { count })}
        />
        {pickBranch ? (
          <SheetPicker<string>
            label={t('branch')}
            value={branch}
            onChange={(nextBranch) => { setBranch(nextBranch); setShowAllDays(false); }}
            options={[{ value: ALL, label: t('allBranches') }, ...(branches.data ?? []).map((item) => ({ value: item._id, label: item.name, hint: item.district }))]}
          />
        ) : null}
      </View>

      <Segmented options={tabs} value={visibleView} onChange={setView} />

      {summary.loading ? <Loading /> : null}
      {summary.error && !data ? <ErrorState message={summary.error} onRetry={() => void summary.refresh()} /> : null}

      {data && totals && visibleView === 'attendance' ? (
        <>
          {serviceDays.length ? (
            <>
              <View style={styles.attendanceCard}>
                <Text style={type.label}>{t('metrics.attendanceTotal')}</Text>
                <Text style={styles.attendanceTotal}>{format.number(totals.attendanceTotal)}</Text>
                <Caption>{t('range.datesValue', { from: format.date(data.range.startDate), to: format.date(data.range.endDate) })}</Caption>
                <View style={styles.attendanceBreakdown}>
                  <View style={styles.metric}>
                    <Text style={type.number}>{format.number(totals.firstTimersTotal)}</Text>
                    <Caption>{t('metrics.firstTimers')}</Caption>
                  </View>
                  <View style={styles.metric}>
                    <Text style={type.number}>{format.number(totals.newConvertsTotal)}</Text>
                    <Caption>{t('metrics.newConverts')}</Caption>
                  </View>
                  <View style={styles.metric}>
                    <Text style={type.number}>{format.number(totals.adultsTotal)} / {format.number(totals.childrenTotal)}</Text>
                    <Caption>{t('range.adultsChildren')}</Caption>
                  </View>
                </View>
              </View>

              <View>
                <Section
                  title={t('serviceDays.title')}
                  action={serviceDays.length > RECENT_SERVICE_DAYS ? t(showAllDays ? 'serviceDays.showLess' : 'serviceDays.showAll') : undefined}
                  onAction={() => setShowAllDays(!showAllDays)}
                />
                <Caption style={{ marginTop: space.xs }}>{t('serviceDays.subtitle')}</Caption>
                {visibleDays.map((day, index) => (
                  <BarRow
                    key={day.date}
                    divider={index > 0}
                    title={format.date(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                    value={format.number(day.attendance)}
                    share={day.attendance / maxAttendance}
                    caption={t('serviceDays.figures', {
                      firstTimers: format.number(day.firstTimers),
                      converts: format.number(day.newConverts),
                    })}
                  />
                ))}
              </View>

              {data.serviceMix.length ? (
                <View>
                  <Section title={t('serviceMix.title')} />
                  {data.serviceMix.map((service, index) => (
                    <BarRow
                      key={service._id}
                      divider={index > 0}
                      title={format.status(service._id)}
                      value={format.number(service.totalPeople)}
                      share={service.totalPeople / maxService}
                      caption={t('serviceMix.summary', {
                        firstTimers: format.number(service.firstTimers),
                        converts: format.number(service.newConverts),
                        reports: format.number(service.summarySubmissions),
                      })}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <EmptyState icon="attendance" title={t('serviceMix.empty')} />
          )}
        </>
      ) : null}

      {totals && visibleView === 'people' ? (
        <>
          <StatGrid>
            <StatTile label={t('metrics.guestTotal')} value={format.number(totals.guestTotal)} hint={t('metrics.guestTotalHint')} />
            <StatTile label={t('metrics.memberTotal')} value={format.number(totals.memberTotal)} hint={t('metrics.memberTotalHint')} />
            <StatTile label={t('metrics.conversionRate')} value={format.number(totals.conversionRate / 100, { style: 'percent', maximumFractionDigits: 1 })} />
            <StatTile label={t('views.returnRate')} value={format.number(totals.returnRate / 100, { style: 'percent', maximumFractionDigits: 1 })} />
          </StatGrid>

          <View>
            <Section title={t('followUp.title')} />
            {data?.followUpBreakdown.length ? (
              data.followUpBreakdown.map((item, index) => (
                <BarRow key={item._id} divider={index > 0} title={format.status(item._id)} value={format.number(item.total)} share={item.total / maxFollowUp} />
              ))
            ) : (
              <EmptyState icon="care" title={t('followUp.empty')} />
            )}
          </View>

        </>
      ) : null}

      {visibleView === 'branches' ? (
        <View>
          <Section title={t('comparison.title')} />
          <Caption style={{ marginTop: space.sm }}>{t('comparison.hint')}</Caption>
          {(comparison.data?.branchTotals.length ?? 0) > SEARCH_FROM ? (
            <View style={{ marginTop: space.md }}>
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('comparison.search')} />
            </View>
          ) : null}
          {comparison.loading ? (
            <Loading />
          ) : comparison.error && !comparison.data ? (
            <ErrorState message={comparison.error} onRetry={() => void comparison.reload()} />
          ) : rows.length ? (
            <View style={{ marginTop: space.xs }}>
              {rows.map((row, index) => (
                <ComparisonRow key={row.key} row={row} divider={index > 0} signed={signed} />
              ))}
            </View>
          ) : (
            <EmptyState icon="building" title={search.trim() ? t('comparison.noMatches') : t('comparison.empty')} />
          )}
        </View>
      ) : null}

      {data ? (
        <View style={{ gap: 6 }}>
          <Button
            label={t('exportCsv')}
            variant="secondary"
            icon="download"
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/reports${query({ days, branchId })}`)}
          />
          <Caption style={{ textAlign: 'center' }}>{t('exportHint')}</Caption>
        </View>
      ) : null}
    </Screen>
  );
}

function ComparisonRow({ row, divider, signed }: { row: ReportGroupTotal; divider: boolean; signed: (value: number) => string }) {
  const t = useT('reports.comparison');
  const format = useAppFormat();
  const reported = row.reports > 0;
  return (
    <ListRow
      divider={divider}
      title={row.label}
      subtitle={reported ? [row.district, t('reports', { count: row.reports }), t('growth', { value: signed(row.growth) })].filter(Boolean).join(' · ') : [row.district, t('missing')].filter(Boolean).join(' · ')}
      right={
        <Text style={[styles.rowValue, !reported && { color: colors.faint }]} accessibilityLabel={reported ? t('attendance', { count: format.number(row.currentAttendance) }) : t('missing')}>
          {reported ? format.number(row.currentAttendance) : '—'}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  shortcutIcon: { padding: space.sm, borderRadius: radius.md, backgroundColor: colors.flameSoft },
  attendanceCard: { padding: space.lg, gap: space.xs, borderRadius: radius.lg, backgroundColor: colors.surface },
  attendanceTotal: { ...type.display, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  attendanceBreakdown: { flexDirection: 'row', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong, marginTop: space.sm, paddingTop: space.md },
  metric: { flex: 1, gap: space.xs },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, fontVariant: ['tabular-nums'] },
});
