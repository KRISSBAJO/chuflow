import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { KeyValue } from '@/components/kit';
import { toast } from '@/components/toast';
import { Badge, Button, Caption, EmptyState, ErrorState, Field, Loading, Notice, Screen, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { AmountNotesEditor } from './entry-editor';
import { BigAmount, confirm, moneyOf } from './shared';
import type { ExpenseEntrySummary } from './types';

type Decision = 'approve' | 'reject';

export function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('finance');
  const format = useAppFormat();
  const money = moneyOf(format);
  const { user } = useSession();
  const { refresh: refreshAlerts } = useAlerts();
  const role = user?.role;
  const entry = useApi<ExpenseEntrySummary>(can.finance(role) && id ? `/finance/expenses/${id}` : null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Decision | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const item = entry.data;
  // Ushers can see expenses but the API's PATCH is for leadership only.
  const canEdit = !!item?.permissions?.canEdit && role !== 'usher';
  const canReview = !!item && item.status === 'submitted' && can.approveExpenses(role);

  async function save(next: { amount: number; notes?: string }) {
    if (!item) return;
    setSaving(true);
    try {
      await api.patch(`/finance/expenses/${item._id}`, { amount: next.amount, notes: next.notes ?? '' });
      entry.setData((current) => current && { ...current, amount: next.amount, notes: next.notes });
      toast.success(t('expense.saved'));
      setEditing(false);
      void entry.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function decide(decision: Decision) {
    if (!item) return;
    if (decision === 'reject' && !(await confirm(t('expense.confirmRejectTitle'), t('expense.confirmRejectBody'), t('expense.reject')))) return;
    setBusy(decision);
    try {
      await api.patch(`/finance/expenses/${item._id}/${decision}`, reviewNote.trim() ? { notes: reviewNote.trim() } : {});
      toast.success(decision === 'approve' ? t('expense.approved') : t('expense.rejected'));
      entry.setData((current) => current && { ...current, status: decision === 'approve' ? 'approved' : 'rejected' });
      setReviewNote('');
      void refreshAlerts();
      void entry.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      safeTop={false}
      refreshing={entry.refreshing}
      onRefresh={() => void entry.refresh()}
      footer={
        canReview && !editing ? (
          <View style={styles.actions}>
            <Button label={t('expense.reject')} variant="secondary" style={{ flex: 1 }} loading={busy === 'reject'} disabled={busy === 'approve'} onPress={() => void decide('reject')} />
            <Button label={t('expense.approve')} icon="check" style={{ flex: 1.4 }} loading={busy === 'approve'} disabled={busy === 'reject'} onPress={() => void decide('approve')} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: item?.expenseCategoryLabel || t('expense.title') }} />
      {!can.finance(role) ? <EmptyState icon="lock" title={t('noAccess')} /> : null}
      {entry.loading ? <Loading /> : null}
      {entry.error && !item ? <ErrorState message={entry.error} onRetry={() => void entry.refresh()} /> : null}

      {item ? (
        <>
          <View style={styles.top}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <BigAmount caption={[item.payee, format.date(item.expenseDate)].filter(Boolean).join(' · ')}>{money(item.amount, item.currency)}</BigAmount>
            </View>
            <Badge label={format.status(item.status)} tone={statusTone(item.status)} />
          </View>

          {item.status === 'submitted' ? <Notice tone="warning" icon="clock">{t('expense.pendingHint')}</Notice> : null}

          {editing ? (
            <AmountNotesEditor amount={item.amount} notes={item.notes} saving={saving} saveLabel={t('expense.save')} onSave={(next) => void save(next)} onCancel={() => setEditing(false)} />
          ) : (
            <View>
              <Section title={t('expense.title')} />
              <KeyValue
                rows={[
                  { label: t('fields.description'), value: item.description },
                  { label: t('fields.category'), value: item.expenseCategoryLabel },
                  { label: t('fields.account'), value: item.accountLabel || item.accountId?.name },
                  { label: t('fields.payee'), value: item.payee },
                  { label: t('fields.expenseDate'), value: format.date(item.expenseDate) },
                  { label: t('fields.branch'), value: item.branchId?.name },
                  { label: t('fields.service'), value: item.serviceLabel },
                  { label: t('fields.currency'), value: item.currency },
                  { label: t('fields.notes'), value: item.notes },
                  { label: t('fields.receipt'), value: item.receiptUrl ? t('expense.openReceipt') : undefined, onPress: item.receiptUrl ? () => void Linking.openURL(item.receiptUrl!) : undefined },
                  { label: t('fields.enteredBy'), value: item.createdBy ? format.fullName(item.createdBy) : undefined },
                  { label: t('fields.recordedAt'), value: item.createdAt ? format.dateTime(item.createdAt) : undefined },
                  { label: t('fields.reviewedAt'), value: item.reviewedAt ? format.dateTime(item.reviewedAt) : undefined },
                  { label: t('fields.reviewNotes'), value: item.reviewNotes },
                ]}
              />
            </View>
          )}

          {canReview && !editing ? (
            <Field label={t('expense.reviewNote')} value={reviewNote} onChangeText={setReviewNote} placeholder={t('expense.reviewNotePlaceholder')} multiline />
          ) : null}

          {!editing && canEdit ? <Button label={t('expense.edit')} variant="secondary" icon="edit" onPress={() => setEditing(true)} /> : null}
          {!editing && item.permissions?.reason ? <Caption>{item.permissions.reason}</Caption> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
});
