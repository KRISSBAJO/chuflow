import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyValue, SearchBar, SheetPicker, StatGrid, StatTile } from '@/components/kit';
import { Button, Caption, EmptyState, ErrorState, ListRow, Loading, Screen, Section } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
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

/*
 * Leadership reports: the website's /reports page (KPIs, reporting window, daily trend,
 * follow-up breakdown, service mix) plus the per-branch comparison from the weekly reports.
 */

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
  const branchId = branch === ALL ? undefined : branch;

  const summary = useApi<ReportsSummary>(allowed ? `/reports/summary${query({ days, branchId })}` : null);
  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - days);
    return { dateFrom: isoDay(from), dateTo: isoDay(to) };
  }, [days]);
  const comparison = useApi<WeeklyReportListResponse>(allowed && pickBranch ? `/intake-templates/weekly-reports${query({ ...range, branchId })}` : null);

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
  const trends = data?.trends.slice(-10) ?? [];
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
        <Caption>{t('description', { days })}</Caption>
        <DaysRow title={tc('time.lastNDays', { count: days })} value={days} options={DAY_OPTIONS} onChange={setDays} label={(count) => t('days', { count })} />
        {pickBranch ? (
          <SheetPicker<string>
            label={t('branch')}
            value={branch}
            onChange={setBranch}
            options={[{ value: ALL, label: t('allBranches') }, ...(branches.data ?? []).map((item) => ({ value: item._id, label: item.name, hint: item.district }))]}
          />
        ) : null}
      </View>

      {summary.loading ? <Loading /> : null}
      {summary.error && !data ? <ErrorState message={summary.error} onRetry={() => void summary.refresh()} /> : null}

      {totals ? (
        <>
          <StatGrid>
            <StatTile label={t('metrics.guestTotal')} value={format.number(totals.guestTotal)} hint={t('metrics.guestTotalHint')} />
            <StatTile label={t('metrics.memberTotal')} value={format.number(totals.memberTotal)} hint={t('metrics.memberTotalHint')} />
            <StatTile label={t('metrics.attendanceTotal')} value={format.number(totals.attendanceTotal)} hint={t('metrics.attendanceTotalHint', { days })} />
            <StatTile label={t('metrics.firstTimers')} value={format.number(totals.firstTimersTotal)} hint={t('metrics.firstTimersHint')} tone="flame" />
            <StatTile label={t('metrics.newConverts')} value={format.number(totals.newConvertsTotal)} hint={t('metrics.newConvertsHint')} />
            <StatTile label={t('metrics.conversionRate')} value={`${format.number(totals.conversionRate)}%`} hint={t('metrics.returnRate', { rate: format.number(totals.returnRate) })} />
          </StatGrid>

          <View>
            <Section title={t('range.title')} />
            <KeyValue
              rows={[
                { label: t('range.dates'), value: t('range.datesValue', { from: format.date(data?.range.startDate), to: format.date(data?.range.endDate) }) },
                { label: t('range.summarySubmissions'), value: format.number(totals.summarySubmissionTotal) },
                { label: t('range.adultsChildren'), value: `${format.number(totals.adultsTotal)} / ${format.number(totals.childrenTotal)}` },
              ]}
            />
          </View>

          <View>
            <Section title={t('daily.title')} />
            <Caption style={{ marginTop: space.sm }}>{t('daily.subtitle')}</Caption>
            {trends.length ? (
              <View style={{ marginTop: space.sm }}>
                <View style={styles.tableRow}>
                  <Text style={[styles.th, { flex: 1.4, textAlign: 'left' }]}>{t('daily.date')}</Text>
                  <Text style={styles.th}>{t('daily.guests')}</Text>
                  <Text style={styles.th}>{t('daily.attendance')}</Text>
                  <Text style={styles.th}>{t('daily.firstTimers')}</Text>
                </View>
                {trends.map((trend) => (
                  <View key={trend.date} style={[styles.tableRow, styles.tableDivider]}>
                    <Text style={[styles.td, styles.tdLabel]} numberOfLines={1}>
                      {format.date(trend.date, { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={styles.td}>{format.number(trend.guests)}</Text>
                    <Text style={styles.td}>{format.number(trend.attendance)}</Text>
                    <Text style={styles.td}>{format.number(trend.firstTimers)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="reports" title={t('daily.empty')} />
            )}
          </View>

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

          <View>
            <Section title={t('serviceMix.title')} />
            {data?.serviceMix.length ? (
              data.serviceMix.map((service, index) => (
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
              ))
            ) : (
              <EmptyState icon="attendance" title={t('serviceMix.empty')} />
            )}
          </View>
        </>
      ) : null}

      {pickBranch ? (
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
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: space.sm },
  tableDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  th: { ...type.micro, flex: 1, textAlign: 'right', textTransform: 'uppercase' },
  td: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.text, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tdLabel: { flex: 1.4, textAlign: 'left', fontFamily: fonts.medium, color: colors.ink },
  rowValue: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink, fontVariant: ['tabular-nums'] },
});
