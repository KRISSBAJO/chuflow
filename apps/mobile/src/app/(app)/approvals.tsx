import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Caption, Card, EmptyState, ErrorState, Loading, Screen, Section } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { branchName } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { AttendanceSubmission, ExpenseEntry, Paginated } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Decision = 'approve' | 'reject';

function confirm(title: string, message: string, labels: { cancel: string; confirm: string }): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: labels.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: labels.confirm, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function Counts({ items }: { items: [string, number | undefined][] }) {
  const format = useAppFormat();
  return (
    <View style={styles.counts}>
      {items
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <View key={label} style={styles.count}>
            <Text style={styles.countValue}>{format.number(value)}</Text>
            <Caption>{label}</Caption>
          </View>
        ))}
    </View>
  );
}

export default function ApprovalsScreen() {
  const { user } = useSession();
  const { summary, refresh: refreshAlerts } = useAlerts();
  const t = useT('approvals');
  const common = useT('common');
  const format = useAppFormat();
  const canExpenses = can.approveExpenses(user?.role);
  const attendance = useApi<{ items: AttendanceSubmission[] }>('/intake-templates/attendance-submissions?status=pending');
  const expenses = useApi<Paginated<ExpenseEntry>>(canExpenses ? '/finance/expenses?status=submitted&limit=20' : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(kind: 'attendance' | 'expense', id: string, decision: Decision) {
    if (
      decision === 'reject' &&
      !(await confirm(t('rejectTitle'), t('rejectBody'), { cancel: common('actions.cancel'), confirm: common('actions.reject') }))
    )
      return;
    setBusy(`${id}:${decision}`);
    try {
      const path = kind === 'attendance' ? `/intake-templates/attendance-submissions/${id}/${decision}` : `/finance/expenses/${id}/${decision}`;
      await api.patch(path, kind === 'expense' ? {} : undefined);
      toast.success(decision === 'approve' ? common('statuses.approved') : common('statuses.rejected'));
      if (kind === 'attendance') attendance.setData((current) => current && { items: current.items.filter((item) => item._id !== id) });
      else expenses.setData((current) => current && { ...current, items: current.items.filter((item) => item._id !== id) });
      void refreshAlerts();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const attendanceItems = attendance.data?.items ?? [];
  const expenseItems = expenses.data?.items ?? [];
  const loading = attendance.loading || (canExpenses && expenses.loading);
  const nothing = !loading && !attendanceItems.length && !expenseItems.length;
  const alerts = (summary?.items ?? []).filter((item) => !['attendance_approvals', 'expense_approvals'].includes(item.key));

  return (
    <Screen
      safeTop={false}
      refreshing={attendance.refreshing}
      onRefresh={() => {
        void attendance.refresh();
        void expenses.refresh();
        void refreshAlerts();
      }}
    >
      <Stack.Screen options={{ title: t('title') }} />
      {loading ? <Loading /> : null}
      {attendance.error && !attendance.data ? <ErrorState message={attendance.error} onRetry={() => void attendance.refresh()} /> : null}

      {nothing && !attendance.error ? <EmptyState icon="check" title={t('emptyTitle')} body={t('emptyBody')} /> : null}

      {attendanceItems.length ? <Section title={t('attendanceReports')} /> : null}
      {attendanceItems.map((item) => (
        <Card key={item._id} style={styles.card}>
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.serviceType || item.serviceName || item.templateName}
              </Text>
              <Caption>
                {[branchName(item.branchId), format.shortDate(item.serviceDate), item.createdAt ? t('sent', { time: format.relativeTime(item.createdAt).toLocaleLowerCase() }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Caption>
            </View>
            <Badge label={common('statuses.pending')} tone="warning" />
          </View>
          <Counts
            items={[
              [t('counts.men'), item.menCount],
              [t('counts.women'), item.womenCount],
              [t('counts.children'), item.childrenCount],
              [t('counts.firstTimers'), item.firstTimersCount],
            ]}
          />
          <View style={styles.actions}>
            <Button label={common('actions.reject')} variant="secondary" size="sm" style={{ flex: 1 }} loading={busy === `${item._id}:reject`} onPress={() => void decide('attendance', item._id, 'reject')} />
            <Button label={common('actions.approve')} icon="check" size="sm" style={{ flex: 1.4 }} loading={busy === `${item._id}:approve`} onPress={() => void decide('attendance', item._id, 'approve')} />
          </View>
        </Card>
      ))}

      {expenseItems.length ? <Section title={t('expenses')} /> : null}
      {expenseItems.map((item) => (
        <Card key={item._id} style={styles.card}>
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.description}
              </Text>
              <Caption>{[item.expenseCategoryLabel, item.payee, branchName(item.branchId), format.shortDate(item.expenseDate)].filter(Boolean).join(' · ')}</Caption>
            </View>
            <Text style={styles.amount}>{format.money(item.amount, item.currency)}</Text>
          </View>
          <View style={styles.actions}>
            <Button label={common('actions.reject')} variant="secondary" size="sm" style={{ flex: 1 }} loading={busy === `${item._id}:reject`} onPress={() => void decide('expense', item._id, 'reject')} />
            <Button label={common('actions.approve')} icon="check" size="sm" style={{ flex: 1.4 }} loading={busy === `${item._id}:approve`} onPress={() => void decide('expense', item._id, 'approve')} />
          </View>
        </Card>
      ))}

      {alerts.length ? (
        <>
          <Section title={t('otherAlerts')} />
          <Card>
            {alerts.map((item) => (
              <View key={item.key} style={styles.alert}>
                <Text style={styles.alertTitle}>{t('alertCount', { count: format.number(item.count), label: item.label.toLocaleLowerCase() })}</Text>
                <Caption>{item.description}</Caption>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: type.title,
  amount: { ...type.title, fontVariant: ['tabular-nums'] },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1, backgroundColor: colors.inset, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  countValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm },
  alert: { paddingVertical: 6 },
  alertTitle: type.label,
});
