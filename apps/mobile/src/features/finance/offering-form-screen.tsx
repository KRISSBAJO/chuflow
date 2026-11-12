import { CustomMemberFields, memberFormPayload, type MemberFormDefinition } from '@/features/members/custom-member-fields';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { DateStepper, SheetPicker } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, EmptyState, Field, Notice, Screen, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage, query } from '@/lib/api';
import { isoDay } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { HomeServiceSchedule } from '@/features/home/today';
import type { ServiceType } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { dayLabel, moneyOf, parseAmount } from './shared';
import { CURRENCIES, type FinanceAccountSummary, type OfferingEntrySummary, type OfferingTypeSummary } from './types';

function offeringRequestId() {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2).padEnd(16, '0')}`;
}

/** Mirrors the website's OfferingEntryForm and CreateOfferingEntryDto; the API scopes it to the user's branch. */
export function NewOfferingScreen() {
  const t = useT('finance');
  const format = useAppFormat();
  const money = moneyOf(format);
  const { user } = useSession();
  const allowed = can.recordOfferings(user?.role, user);
  const branchId = userBranchId(user);
  const definition = useApi<MemberFormDefinition>(allowed ? '/finance/staff-form/offering' : null);
  const [custom, setCustom] = useState<Record<string, string | number>>({});

  const serviceTypes = useApi<ServiceType[]>(allowed ? '/service-types' : null);
  const serviceSchedules = useApi<(HomeServiceSchedule & { _id: string; financeEntryEnabled?: boolean })[]>(
    allowed && branchId ? `/service-schedules${query({ branchId })}` : null,
  );
  const offeringTypes = useApi<OfferingTypeSummary[]>(allowed ? '/finance/offering-types' : null);
  const accounts = useApi<FinanceAccountSummary[]>(allowed ? '/finance/accounts' : null);

  const [date, setDate] = useState(() => new Date());
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [offeringTypeId, setOfferingTypeId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('');
  const [lines, setLines] = useState<{ offeringTypeId: string; accountId?: string; amount: number; paymentChannel?: string }[]>([]);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [currency, setCurrency] = useState<string>('USD');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const services = useMemo(() => (serviceTypes.data ?? []).filter((item) => item.isActive !== false), [serviceTypes.data]);
  const types = useMemo(() => (offeringTypes.data ?? []).filter((item) => item.isActive !== false), [offeringTypes.data]);
  const funds = useMemo(() => (accounts.data ?? []).filter((item) => item.isActive !== false), [accounts.data]);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date).toLowerCase();
  const schedules = (serviceSchedules.data ?? []).flatMap((schedule) => {
    const typeId = typeof schedule.serviceTypeId === 'string' ? schedule.serviceTypeId : schedule.serviceTypeId?._id;
    if (!schedule.isActive || schedule.financeEntryEnabled === false || schedule.dayOfWeek !== weekday || !services.some((service) => service._id === typeId)) return [];
    return [{ value: schedule._id, label: schedule.name, hint: schedule.startTime, typeId }];
  });
  const selectedSchedule = schedules.find((schedule) => schedule.value === scheduleId);

  function readLine() {
    const parsed = parseAmount(amount);
    const nextErrors: Record<string, string> = {};
    if (!offeringTypeId) nextErrors.offeringType = t('offeringForm.errors.offeringType');
    if (!(parsed > 0)) nextErrors.amount = t('offeringForm.errors.amount');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;
    return { offeringTypeId, accountId: accountId || undefined, amount: parsed, paymentChannel: paymentChannel.trim() || undefined };
  }

  function addLine() {
    if (lines.length >= 19) return;
    const line = readLine();
    if (!line) return;
    setLines([...lines, line]);
    setOfferingTypeId('');
    setAmount('');
    setPaymentChannel('');
  }

  async function save() {
    const currentLine = !lines.length || amount || offeringTypeId || paymentChannel ? readLine() : null;
    if ((!lines.length || amount || offeringTypeId || paymentChannel) && !currentLine) return;
    const selectedServiceTypeId = selectedSchedule?.typeId || serviceTypeId;
    if (!selectedServiceTypeId) {
      setErrors({ service: t('offeringForm.errors.service') });
      return;
    }

    const form = definition.data;
    if (!form) { toast.error(t('customLoadFailed')); void definition.refresh(); return; }
    setSaving(true);
    setFormError(null);
    try {
      const entries = [...lines, ...(currentLine ? [currentLine] : [])].map((line) => ({
        ...memberFormPayload(form, custom),
        serviceDate: isoDay(date),
        ...(selectedServiceTypeId === 'date-only' ? {} : { serviceTypeId: selectedServiceTypeId }),
        ...(selectedSchedule ? { serviceScheduleId: selectedSchedule.value } : {}),
        ...line,
        currency,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }));
      const payloadKey = JSON.stringify(entries);
      if (request.current?.payload !== payloadKey) {
        request.current = {
          payload: payloadKey,
          id: offeringRequestId(),
        };
      }
      const [entry] = await api.post<OfferingEntrySummary[]>('/finance/offerings/batch', { entries, requestId: request.current.id });
      request.current = null;
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
      <Screen safeTop={false} footer={<Button label={t('offeringForm.save')} size="lg" loading={saving} onPress={() => void save()} />}>
        <Caption>{t('offeringForm.intro')}</Caption>
        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <View style={{ gap: 6 }}>
          <Section title={t('fields.serviceDate')} />
          <DateStepper value={date} onChange={(nextDate) => {
            setDate(nextDate);
            setScheduleId('');
          }} label={dayLabel(format, date)} />
        </View>

        {schedules.length ? (
          <SheetPicker<string>
            label={t('offeringForm.scheduledService')}
            value={selectedSchedule?.value ?? ''}
            options={[{ value: '', label: t('offeringForm.noSchedule') }, ...schedules]}
            onChange={setScheduleId}
          />
        ) : null}
        {!selectedSchedule ? <SheetPicker<string>
          label={t('fields.service')}
          required
          value={serviceTypeId}
          options={[{ value: 'date-only', label: t('offeringForm.dateOnly') }, ...services.map((item) => ({ value: item._id, label: item.name }))]}
          onChange={setServiceTypeId}
          placeholder={t('offeringForm.selectService')}
          error={errors.service}
        /> : null}

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
        <Field label={t('offeringForm.paymentChannel')} value={paymentChannel} onChangeText={setPaymentChannel} maxLength={80} />
        {lines.map((line, index) => (
          <View key={index} style={{ gap: space.sm }}>
            <Caption>{types.find((item) => item._id === line.offeringTypeId)?.name} · {money(line.amount, currency)}</Caption>
            <Button variant="secondary" label={t('offeringForm.removeLine')} disabled={saving} onPress={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))} />
          </View>
        ))}
        <Button variant="secondary" label={t('offeringForm.addLine')} disabled={saving || lines.length >= 19} onPress={addLine} />
        <Caption>{t('offeringForm.batchTotal', { amount: money(lines.reduce((sum, line) => sum + line.amount, 0) + (parseAmount(amount) || 0), currency) })}</Caption>

        <View style={{ gap: space.sm }}>
          <Section title={t('fields.currency')} />
          <View style={styles.chips}>
            {CURRENCIES.map((code) => (
              <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
            ))}
          </View>
        </View>

        {!definition.data?.hiddenStaff.includes('notes') ? <Field label={t('fields.notes')} value={notes} onChangeText={setNotes} placeholder={t('offeringForm.notesPlaceholder')} multiline /> : null}
        <CustomMemberFields form={definition.data ?? undefined} values={custom} onChange={setCustom} title={t('customAnswers')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amount: { fontVariant: ['tabular-nums'] },
});
