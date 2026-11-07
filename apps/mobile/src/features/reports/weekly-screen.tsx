import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { KeyValue, SheetPicker } from '@/components/kit';
import { toast } from '@/components/toast';
import { Badge, Button, Caption, EmptyState, ErrorState, Field, Loading, Notice, Screen, Section } from '@/components/ui';
import { space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import type { BranchSummary } from '@/lib/types';

import { weeklyFigureError, weeklyFigureFlags, weeklyFigureNumber, WSF_AVERAGE } from './weekly-report-figures';

const FIELDS = [
  'currentAttendance',
  'firstTimersCount',
  'newConvertsCount',
  'believersFoundationClassCount',
  'holySpiritBaptismCount',
  'waterBaptismCount',
  'covenantHourOfPrayerAttendance',
  'winnersSatelliteFellowshipAverage',
  'cellCount',
  'newCellCount',
  'wofbiAttendance',
];
type Report = { _id: string; status: string; workflowRevision?: number; submittedBy?: string; remarks?: string; [key: string]: unknown };
type Matrix = {
  canReview: boolean;
  weekEnding: string;
  rows: { branch: BranchSummary; report: Report | null }[];
  totals: Record<string, number | null>;
  coverage: { total: number; acknowledged: number };
};
type Packet = { _id: string; status: string; district: string; recipientId: string; weekEnding: string; reviewNote?: string; snapshot: Matrix };

export function WeeklyReportsScreen({ form = false }: { form?: boolean }) {
  const t = useT('reports.weekly');
  const format = useAppFormat();
  const { user } = useSession();
  const params = useLocalSearchParams<{ id?: string; week?: string; branchId?: string }>();
  const allowed = can.reports(user?.role);
  const [week, setWeek] = useState(params.week || new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState(params.branchId || (typeof user?.branchId === 'string' ? user.branchId : user?.branchId?._id) || '');
  const [figures, setFigures] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [district, setDistrict] = useState('');
  const [recipient, setRecipient] = useState('');
  const [expanded, setExpanded] = useState('');
  const [note, setNote] = useState('');
  const branches = useApi<BranchSummary[]>(allowed ? '/branches/options' : null);
  const matrix = useApi<Matrix>(allowed ? `/weekly-reports${query({ weekEnding: week })}` : null);
  const packets = useApi<Packet[]>(allowed ? '/weekly-reports/packets' : null);
  const defaults = useApi<Record<string, number>>(allowed && branch ? `/weekly-reports/defaults${query({ branchId: branch, weekEnding: week })}` : null);
  const selectedDistrict = branches.data?.find((b) => `${b.oversightRegion}|${b.district}` === district);
  const recipients = useApi<{ _id: string; name: string }[]>(
    allowed && selectedDistrict ? `/weekly-reports/recipients${query({ district: selectedDistrict.district, oversightRegion: selectedDistrict.oversightRegion })}` : null,
  );
  const current = params.id ? matrix.data?.rows.find((row) => row.report?._id === params.id)?.report : undefined;
  const locked = current?.status === 'approved';
  const [loadedId,setLoadedId]=useState('');
  if(current && loadedId!==current._id){
    setLoadedId(current._id);
    setFigures(Object.fromEntries(FIELDS.map(key=>[key,current[key]===undefined?'':String(current[key])])));
    setRemarks(current.remarks||'');
  }
  const n = (value: unknown) => (typeof value === 'number' ? format.number(value, { maximumFractionDigits: 2 }) : '—');
  async function action(run: () => Promise<unknown>, back = false) {
    setBusy(true);
    try {
      await run();
      toast.success(t('saved'));
      if (back) router.replace('/weekly-reports' as Href);
      else {
        await matrix.reload();
        await packets.reload();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (key: string) => weeklyFigureError(key, figures[key] ?? '', figures.currentAttendance ?? '');
  const hasFigureErrors = FIELDS.some((key) => fieldError(key));
  const values = Object.fromEntries(FIELDS.filter((key) => figures[key]).map((key) => [key, weeklyFigureNumber(figures[key])]));
  const flags = locked && current
    ? weeklyFigureFlags(current, current.previousAttendance, FIELDS)
    : weeklyFigureFlags(values, defaults.data?.previousAttendance, FIELDS).filter(({ key }) => !fieldError(key));

  function save(submit: boolean) {
    if (hasFigureErrors) return;
    if (submit && FIELDS.some((key) => !figures[key])) {
      toast.error(t('completeFigures'));
      setStep(1);
      return;
    }
    const payload = { branchId: branch, weekEnding: week, figures: values, remarks, submit, revision: current?.workflowRevision ?? 0 };
    void action(() => (params.id ? api.patch(`/weekly-reports/${params.id}`, payload) : api.post('/weekly-reports', payload)), true);
  }
  return (
    <Screen safeTop={false} refreshing={matrix.refreshing} onRefresh={() => void matrix.refresh()} contentStyle={{ gap: space.md }}>
      <Stack.Screen options={{ title: t('title') }} />
      {!allowed ? (
        <EmptyState icon="lock" title={t('unknown')} />
      ) : (
        <>
          <Caption>{t('summaryHint')}</Caption>
          <Field label={t('week') + ' (YYYY-MM-DD)'} value={week} editable={!params.id && !busy} onChangeText={setWeek} />
          {matrix.loading ? <Loading /> : null}
          {matrix.error ? <ErrorState message={matrix.error} onRetry={() => void matrix.refresh()} /> : null}
          {form ? (
            <>
              <SheetPicker
                label={t('branch')}
                value={branch}
                options={(branches.data ?? []).filter((b) => !params.id || b._id === branch).map((b) => ({ value: b._id, label: b.name }))}
                onChange={setBranch}
              />
              {locked ? <Caption>{t('locked')}</Caption> : null}
              <Section title={t(step === 1 ? 'firstStep' : 'next')} />
              {step === 1 && !locked ? (
                <>
                  {FIELDS.map((key) => (
                    <Field
                      key={key}
                      label={t(`fields.${key}`)}
                      value={figures[key] ?? ''}
                      keyboardType={key === WSF_AVERAGE ? "decimal-pad" : "number-pad"}
                      error={fieldError(key) ? t(`validation.${fieldError(key)}`) : undefined}
                      onChangeText={(value) => setFigures({ ...figures, [key]: value })}
                    />
                  ))}
                  <Field label={t('remarks')} value={remarks} onChangeText={setRemarks} multiline />
                  <Button label={t('next')} disabled={hasFigureErrors} onPress={() => setStep(2)} />
                </>
              ) : (
                <>
                  <KeyValue
                    rows={FIELDS.map((key) => ({
                      label: t(`fields.${key}`),
                      value: n(locked ? current?.[key] : figures[key] !== undefined && figures[key] !== '' ? weeklyFigureNumber(figures[key]) : undefined),
                    }))}
                  />
                  {!locked ? <Button label={t('firstStep')} variant="secondary" onPress={() => setStep(1)} /> : null}
                </>
              )}
              <KeyValue
                rows={['previousAttendance', 'averageLastYear', 'averageLastPeriod'].map((key) => ({ label: t(key), value: n(locked ? current?.[key] : defaults.data?.[key]) }))}
              />
              {flags.map(({ key, message }) => (
                <Notice key={`${key}-${message}`} tone="warning">
                  {t(`fields.${key}`)} · {t(`validation.${message}`)}
                </Notice>
              ))}
              {!locked ? (
                <>
                  <Button label={t('save')} variant="secondary" disabled={busy || hasFigureErrors || !branch || !matrix.data || (!!params.id && !current)} onPress={() => save(false)} />
                  {step === 2 ? <Button label={t('submit')} disabled={busy || hasFigureErrors || !branch || !matrix.data || (!!params.id && !current)} onPress={() => save(true)} /> : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <Button label={t('new')} icon="plus" onPress={() => router.push(`/weekly-reports/new?week=${week}` as Href)} />
              {matrix.data ? (
                <>
                  <Text style={type.title}>
                    {t('coverage')}: {matrix.data.coverage.acknowledged} / {matrix.data.coverage.total}
                  </Text>
                  <Section title={t('totals')} />
                  <KeyValue
                    rows={['currentAttendance', 'previousAttendance', 'growth', 'growthPercent'].map((key) => ({
                      label: t(key === 'currentAttendance' ? `fields.${key}` : key),
                      value: n(matrix.data?.totals[key]),
                    }))}
                  />
                  {matrix.data.rows.map((row) => (
                    <View key={row.branch._id} style={{ gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: '#ecebe7' }}>
                      <Text style={type.title}>{row.branch.name}</Text>
                      <Badge label={t(row.report?.status || 'missing')} />
                      {row.report ? (
                        <>
                          <KeyValue
                            rows={[
                              { label: t('fields.currentAttendance'), value: n(row.report.currentAttendance) },
                              { label: t('growth'), value: n(row.report.growth) },
                            ]}
                          />
                          {weeklyFigureFlags(row.report, row.report.previousAttendance, FIELDS).map(({ key, message }) => (
                            <Notice key={`${key}-${message}`} tone="warning">
                              {t(`fields.${key}`)} · {t(`validation.${message}`)}
                            </Notice>
                          ))}
                          <Button
                            label={t('open')}
                            variant="secondary"
                            size="sm"
                            onPress={() => router.push(`/weekly-reports/manage/${row.report!._id}?week=${week}&branchId=${row.branch._id}` as Href)}
                          />
                          {matrix.data?.canReview && row.report.status === 'pending' && row.report.submittedBy !== (user?.id||user?._id)
                            ? (['approved', 'rejected'] as const).map((decision) => (
                                <Button
                                  key={decision}
                                  label={t(decision === 'approved' ? 'acknowledge' : 'return')}
                                  size="sm"
                                  disabled={busy}
                                  onPress={() =>
                                    void action(() => api.patch(`/weekly-reports/${row.report!._id}/review`, { decision, revision: row.report!.workflowRevision ?? 0 }))
                                  }
                                />
                              ))
                            : null}
                        </>
                      ) : null}
                    </View>
                  ))}
                  {matrix.data.canReview ? (
                    <>
                      <Section title={t('forward')} />
                      <SheetPicker
                        label={t('district')}
                        value={district}
                        options={[...new Set((branches.data ?? []).map((b) => `${b.oversightRegion}|${b.district}`))].map((value) => ({ value, label: value.replace('|', ' · ') }))}
                        onChange={(value) => {
                          setDistrict(value);
                          setRecipient('');
                        }}
                      />
                      <SheetPicker
                        label={t('recipient')}
                        value={recipient}
                        options={(recipients.data ?? []).map((r) => ({ value: r._id, label: r.name }))}
                        onChange={setRecipient}
                      />
                      <Button
                        label={t('forward')}
                        disabled={busy || !recipient || !selectedDistrict}
                        onPress={() =>
                          void action(() =>
                            api.post('/weekly-reports/packets', {
                              district: selectedDistrict!.district,
                              oversightRegion: selectedDistrict!.oversightRegion,
                              weekEnding: week,
                              recipientId: recipient,
                            }),
                          )
                        }
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              <Section title={t('packets')} />
              {(packets.data ?? []).map((packet) => (
                <View key={packet._id} style={{ gap: space.sm }}>
                  <Button
                    variant="secondary"
                    label={`${packet.district} · ${packet.weekEnding.slice(0, 10)} · ${t(packet.status)}`}
                    onPress={() => setExpanded(expanded === packet._id ? '' : packet._id)}
                  />
                  {expanded === packet._id ? (
                    <>
                      <Caption>{t('snapshot')}</Caption>
                      {packet.snapshot.rows.map((row) => (
                        <KeyValue key={row.branch._id} rows={[{ label: row.branch.name, value: n(row.report?.currentAttendance) }]} />
                      ))}
                      {packet.reviewNote ? <Caption>{packet.reviewNote}</Caption> : null}
                      {packet.status === 'submitted' && packet.recipientId === (user?.id||user?._id) ? (
                        <>
                          <Field label={t('reviewNote')} value={note} onChangeText={setNote} />
                          {(['acknowledged', 'returned'] as const).map((decision) => (
                            <Button
                              key={decision}
                              label={t(decision === 'acknowledged' ? 'acknowledge' : 'return')}
                              disabled={busy}
                              onPress={() => void action(() => api.patch(`/weekly-reports/packets/${packet._id}`, { decision, note }))}
                            />
                          ))}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
