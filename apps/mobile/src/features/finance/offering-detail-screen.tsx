import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KeyValue } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, EmptyState, ErrorState, Loading, Screen, Section } from '@/components/ui';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { AmountNotesEditor } from './entry-editor';
import { BigAmount, moneyOf } from './shared';
import type { OfferingEntrySummary } from './types';

export function OfferingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('finance');
  const format = useAppFormat();
  const money = moneyOf(format);
  const { user } = useSession();
  const entry = useApi<OfferingEntrySummary>(can.finance(user?.role) && id ? `/finance/offerings/${id}` : null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const item = entry.data;
  const canEdit = !!item?.permissions?.canEdit;

  async function save(next: { amount: number; notes?: string }) {
    if (!item) return;
    setSaving(true);
    try {
      await api.patch(`/finance/offerings/${item._id}`, { amount: next.amount, notes: next.notes ?? '' });
      entry.setData((current) => current && { ...current, amount: next.amount, notes: next.notes });
      toast.success(t('offering.saved'));
      setEditing(false);
      void entry.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen safeTop={false} refreshing={entry.refreshing} onRefresh={() => void entry.refresh()}>
      <Stack.Screen options={{ title: item?.offeringTypeLabel || t('offering.title') }} />
      {!can.finance(user?.role) ? <EmptyState icon="lock" title={t('noAccess')} /> : null}
      {entry.loading ? <Loading /> : null}
      {entry.error && !item ? <ErrorState message={entry.error} onRetry={() => void entry.refresh()} /> : null}

      {item ? (
        <>
          <BigAmount caption={[item.serviceLabel || item.serviceTypeLabel, format.date(item.serviceDate)].filter(Boolean).join(' · ')}>{money(item.amount, item.currency)}</BigAmount>

          {editing ? (
            <AmountNotesEditor amount={item.amount} notes={item.notes} saving={saving} saveLabel={t('offering.save')} onSave={(next) => void save(next)} onCancel={() => setEditing(false)} />
          ) : (
            <View>
              <Section title={t('offering.title')} />
              <KeyValue
                rows={[
                  { label: t('fields.offeringType'), value: item.offeringTypeLabel },
                  { label: t('fields.service'), value: item.serviceLabel || item.serviceTypeLabel },
                  { label: t('fields.serviceDate'), value: format.date(item.serviceDate) },
                  { label: t('fields.branch'), value: item.branchId?.name },
                  { label: t('fields.account'), value: item.accountId?.name },
                  { label: t('fields.currency'), value: item.currency },
                  { label: t('fields.notes'), value: item.notes },
                  { label: t('fields.enteredBy'), value: item.createdBy ? format.fullName(item.createdBy) : undefined },
                  { label: t('fields.recordedAt'), value: item.createdAt ? format.dateTime(item.createdAt) : undefined },
                ]}
              />
            </View>
          )}

          {!editing && canEdit ? <Button label={t('offering.edit')} variant="secondary" icon="edit" onPress={() => setEditing(true)} /> : null}
          {!editing && item.permissions?.reason ? <Caption>{item.permissions.reason}</Caption> : null}
        </>
      ) : null}
    </Screen>
  );
}
