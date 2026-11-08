import { CustomMemberFields, memberFormPayload, type MemberFormDefinition } from '@/features/members/custom-member-fields';
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
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { dayLabel, parseAmount } from './shared';
import { CURRENCIES, type ExpenseCategorySummary, type ExpenseEntrySummary, type FinanceAccountSummary } from './types';

/** Mirrors the website's ExpenseEntryForm and CreateExpenseEntryDto. */
export function NewExpenseScreen() {
  const t = useT('finance');
  const format = useAppFormat();
  const { user } = useSession();
  const allowed = can.recordExpenses(user?.role);
  const definition = useApi<MemberFormDefinition>(allowed ? '/finance/staff-form/expense' : null);
  const [custom, setCustom] = useState<Record<string, string | number>>({});
  const pickBranch = can.pickBranch(user?.role);

  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const categories = useApi<ExpenseCategorySummary[]>(allowed ? '/finance/expense-categories' : null);
  const accounts = useApi<FinanceAccountSummary[]>(allowed ? '/finance/accounts' : null);

  const [branchId, setBranchId] = useState(userBranchId(user));
  const [date, setDate] = useState(() => new Date());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryList = useMemo(() => (categories.data ?? []).filter((item) => item.isActive !== false), [categories.data]);
  const funds = useMemo(() => (accounts.data ?? []).filter((item) => item.isActive !== false), [accounts.data]);
  const branchList = branches.data ?? [];
  const effectiveBranchId = branchId || (branchList.length === 1 ? branchList[0]._id : '');

  /** Picking a category fills in its default account, as on the website, unless one was chosen already. */
  function chooseCategory(id: string) {
    setCategoryId(id);
    const category = categoryList.find((item) => item._id === id);
    const match = funds.find((account) => account.key === category?.defaultAccountKey);
    if (!accountId && match) setAccountId(match._id);
  }

  async function save() {
    const parsed = parseAmount(amount);
    const nextErrors: Record<string, string> = {};
    if (pickBranch && !effectiveBranchId) nextErrors.branch = t('expenseForm.errors.branch');
    if (!categoryId) nextErrors.category = t('expenseForm.errors.category');
    if (!accountId) nextErrors.account = t('expenseForm.errors.account');
    if (!description.trim()) nextErrors.description = t('expenseForm.errors.description');
    if (!(parsed > 0)) nextErrors.amount = t('expenseForm.errors.amount');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    if (!definition.data) { toast.error(t('customLoadFailed')); void definition.refresh(); return; }
    setSaving(true);
    setFormError(null);
    try {
      const entry = await api.post<ExpenseEntrySummary>('/finance/expenses', {
        ...memberFormPayload(definition.data, custom),
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        expenseDate: isoDay(date),
        accountId,
        expenseCategoryId: categoryId,
        ...(payee.trim() ? { payee: payee.trim() } : {}),
        description: description.trim(),
        amount: parsed,
        currency,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(t('expenseForm.saved'));
      router.replace(`/finance/expenses/${entry._id}` as Href);
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('expenseForm.title') }} />
        <EmptyState icon="lock" title={t('noAccess')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('expenseForm.title') }} />
      <Screen safeTop={false} footer={<Button label={t('expenseForm.save')} size="lg" loading={saving} onPress={() => void save()} />}>
        <Caption>{t('expenseForm.intro')}</Caption>
        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        {pickBranch ? (
          <SheetPicker<string>
            label={t('fields.branch')}
            required
            value={effectiveBranchId}
            options={branchList.map((branch) => ({ value: branch._id, label: branch.name, hint: [branch.district, branch.oversightRegion].filter(Boolean).join(' · ') }))}
            onChange={setBranchId}
            placeholder={t('expenseForm.selectBranch')}
            error={errors.branch}
          />
        ) : null}

        <View style={{ gap: 6 }}>
          <Section title={t('fields.expenseDate')} />
          <DateStepper value={date} onChange={setDate} label={dayLabel(format, date)} />
        </View>

        <SheetPicker<string>
          label={t('fields.category')}
          required
          value={categoryId}
          options={categoryList.map((item) => ({ value: item._id, label: item.name, hint: item.description }))}
          onChange={chooseCategory}
          placeholder={t('expenseForm.selectCategory')}
          error={errors.category}
        />

        <SheetPicker<string>
          label={t('fields.account')}
          required
          value={accountId}
          options={funds.map((item) => ({ value: item._id, label: item.name, hint: item.description }))}
          onChange={setAccountId}
          placeholder={t('expenseForm.selectAccount')}
          error={errors.account}
        />

        {!definition.data?.hiddenStaff.includes('payee') ? <Field label={t('fields.payee')} value={payee} onChangeText={setPayee} placeholder={t('expenseForm.payeePlaceholder')} autoCapitalize="words" /> : null}
        <Field
          label={t('fields.description')}
          required
          value={description}
          onChangeText={setDescription}
          placeholder={t('expenseForm.descriptionPlaceholder')}
          autoCapitalize="sentences"
          error={errors.description}
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

        {!definition.data?.hiddenStaff.includes('notes') ? <Field label={t('fields.notes')} value={notes} onChangeText={setNotes} placeholder={t('expenseForm.notesPlaceholder')} multiline /> : null}
        <CustomMemberFields form={definition.data ?? undefined} values={custom} onChange={setCustom} title={t('customAnswers')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amount: { fontVariant: ['tabular-nums'] },
});
