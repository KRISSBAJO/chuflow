import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Caption, Card, EmptyState, ErrorState, Loading, Screen, Section } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { branchName, formatMoney, formatNumber, relativeTime, shortDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { AttendanceSubmission, ExpenseEntry, Paginated } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Decision = 'approve' | 'reject';

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Reject', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function Counts({ items }: { items: [string, number | undefined][] }) {
  return (
    <View style={styles.counts}>
      {items
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <View key={label} style={styles.count}>
            <Text style={styles.countValue}>{formatNumber(value)}</Text>
            <Caption>{label}</Caption>
          </View>
        ))}
    </View>
  );
}

export default function ApprovalsScreen() {
  const { user } = useSession();
  const { summary, refresh: refreshAlerts } = useAlerts();
  const canExpenses = can.approveExpenses(user?.role);
  const attendance = useApi<{ items: AttendanceSubmission[] }>('/intake-templates/attendance-submissions?status=pending');
  const expenses = useApi<Paginated<ExpenseEntry>>(canExpenses ? '/finance/expenses?status=submitted&limit=20' : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(kind: 'attendance' | 'expense', id: string, decision: Decision) {
    if (decision === 'reject' && !(await confirm('Reject this?', 'The branch will need to send it again.'))) return;
    setBusy(`${id}:${decision}`);
    try {
      const path = kind === 'attendance' ? `/intake-templates/attendance-submissions/${id}/${decision}` : `/finance/expenses/${id}/${decision}`;
      await api.patch(path, kind === 'expense' ? {} : undefined);
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected');
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
      {loading ? <Loading /> : null}
      {attendance.error && !attendance.data ? <ErrorState message={attendance.error} onRetry={() => void attendance.refresh()} /> : null}

      {nothing && !attendance.error ? <EmptyState icon="check" title="Nothing waiting" body="Attendance reports and expenses that need your approval show up here." /> : null}

      {attendanceItems.length ? <Section title="Attendance reports" /> : null}
      {attendanceItems.map((item) => (
        <Card key={item._id} style={styles.card}>
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.serviceType || item.serviceName || item.templateName}
              </Text>
              <Caption>{[branchName(item.branchId), shortDate(item.serviceDate), `sent ${relativeTime(item.createdAt).toLowerCase()}`].filter(Boolean).join(' · ')}</Caption>
            </View>
            <Badge label="Pending" tone="warning" />
          </View>
          <Counts
            items={[
              ['Men', item.menCount],
              ['Women', item.womenCount],
              ['Children', item.childrenCount],
              ['First-timers', item.firstTimersCount],
            ]}
          />
          <View style={styles.actions}>
            <Button label="Reject" variant="secondary" size="sm" style={{ flex: 1 }} loading={busy === `${item._id}:reject`} onPress={() => void decide('attendance', item._id, 'reject')} />
            <Button label="Approve" icon="check" size="sm" style={{ flex: 1.4 }} loading={busy === `${item._id}:approve`} onPress={() => void decide('attendance', item._id, 'approve')} />
          </View>
        </Card>
      ))}

      {expenseItems.length ? <Section title="Expenses" /> : null}
      {expenseItems.map((item) => (
        <Card key={item._id} style={styles.card}>
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.description}
              </Text>
              <Caption>{[item.expenseCategoryLabel, item.payee, branchName(item.branchId), shortDate(item.expenseDate)].filter(Boolean).join(' · ')}</Caption>
            </View>
            <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
          </View>
          <View style={styles.actions}>
            <Button label="Reject" variant="secondary" size="sm" style={{ flex: 1 }} loading={busy === `${item._id}:reject`} onPress={() => void decide('expense', item._id, 'reject')} />
            <Button label="Approve" icon="check" size="sm" style={{ flex: 1.4 }} loading={busy === `${item._id}:approve`} onPress={() => void decide('expense', item._id, 'approve')} />
          </View>
        </Card>
      ))}

      {alerts.length ? (
        <>
          <Section title="Other alerts" />
          <Card>
            {alerts.map((item) => (
              <View key={item.key} style={styles.alert}>
                <Text style={styles.alertTitle}>
                  {item.count} {item.label.toLowerCase()}
                </Text>
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
