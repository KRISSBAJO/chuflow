import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { DateStepper, SheetPicker } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, EmptyState, Field, Notice, Screen, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { isoDay } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { ServiceType } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { dayLabel, parseAmount } from './shared';
import { CURRENCIES, type FinanceAccountSummary, type OfferingEntrySummary, type OfferingTypeSummary } from './types';

/** Mirrors the website's OfferingEntryForm and CreateOfferingEntryDto; the API scopes it to the user's branch. */
export function NewOfferingScreen() {
  const t = useT('finance');
  const format = useAppFormat();
  const { user } = useSession();
  const allowed = can.recordOfferings(user?.role);

  const serviceTypes = useApi<ServiceType[]>(allowed ? '/service-types' : null);
  const offeringTypes = useApi<OfferingTypeSummary[]>(allowed ? '/finance/offering-types' : null);
  const accounts = useApi<FinanceAccountSummary[]>(allowed ? '/finance/accounts' : null);

  const [date, setDate] = useState(() => new Date());
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [offeringTypeId, setOfferingTypeId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useMemo(() => (serviceTypes.data ?? []).filter((item) => item.isActive !== false), [serviceTypes.data]);
  const types = useMemo(() => (offeringTypes.data ?? []).filter((item) => item.isActive !== false), [offeringTypes.data]);
  const funds = useMemo(() => (accounts.data ?? []).filter((item) => item.isActive !== false), [accounts.data]);

  async function save() {
    const parsed = parseAmount(amount);
    const nextErrors: Record<string, string> = {};
    if (!serviceTypeId) nextErrors.service = t('offeringForm.errors.service');
    if (!offeringTypeId) nextErrors.offeringType = t('offeringForm.errors.offeringType');
    if (!(parsed > 0)) nextErrors.amount = t('offeringForm.errors.amount');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setFormError(null);
    try {
      const entry = await api.post<OfferingEntrySummary>('/finance/offerings', {
        serviceDate: isoDay(date),
        serviceTypeId,
        offeringTypeId,
        ...(accountId ? { accountId } : {}),
        amount: parsed,
        currency,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(t('offeringForm.saved'));
      router.replace(`/finance/offerings/${entry._id}` as Href);
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('offeringForm.title') }} />
        <EmptyState icon="lock" title={t('noAccess')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('offeringForm.title') }} />
      <Screen safeTop={false} footer={<Button label={t('offeringForm.save')} size="lg" loading={saving} disabled={!services.length} onPress={() => void save()} />}>
        <Caption>{t('offeringForm.intro')}</Caption>
        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <View style={{ gap: 6 }}>
          <Section title={t('fields.serviceDate')} />
          <DateStepper value={date} onChange={setDate} label={dayLabel(format, date)} />
        </View>

        <SheetPicker<string>
          label={t('fields.service')}
          required
          value={serviceTypeId}
          options={services.map((item) => ({ value: item._id, label: item.name }))}
          onChange={setServiceTypeId}
          placeholder={t('offeringForm.selectService')}
          error={errors.service}
          hint={!serviceTypes.loading && !services.length ? t('offeringForm.noServiceTypes') : undefined}
        />

        <SheetPicker<string>
          label={t('fields.offeringType')}
          required
          value={offeringTypeId}
          options={types.map((item) => ({ value: item._id, label: item.name, hint: item.description }))}
          onChange={setOfferingTypeId}
          placeholder={t('offeringForm.selectOfferingType')}
          error={errors.offeringType}
        />

        <SheetPicker<string>
          label={t('fields.account')}
          value={accountId}
          options={[{ value: '', label: t('offeringForm.defaultAccount') }, ...funds.map((item) => ({ value: item._id, label: item.name, hint: item.description }))]}
          onChange={setAccountId}
        />

        <Field
          label={t('fields.amount')}
          required
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0.00"
          error={errors.amount}
          style={styles.amount}
        />

        <View style={{ gap: space.sm }}>
          <Section title={t('fields.currency')} />
          <View style={styles.chips}>
            {CURRENCIES.map((code) => (
              <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
            ))}
          </View>
        </View>

        <Field label={t('fields.notes')} value={notes} onChangeText={setNotes} placeholder={t('offeringForm.notesPlaceholder')} multiline />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amount: { fontVariant: ['tabular-nums'] },
});
