import { router, Stack } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, Field, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useI18n, useT } from '@/i18n/provider';
import type { StaffGuestForm } from '@/features/guests/staff-guest-form';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage, NetworkError } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary, GuestDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type VisitStatus = 'first_time' | 'returned';

export default function NewGuestScreen() {
  const { user } = useSession();
  const { refresh: refreshAlerts } = useAlerts();
  const t = useT('guests.new');
  const common = useT('common');
  const fieldsText = useT('guests.fields');
  const { locale } = useI18n();
  const definition = useApi<StaffGuestForm>('/guests/staff-form');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const visible = (key: string) => !definition.data?.hiddenStaff.includes(key);
  const pickBranch = can.pickBranch(user?.role);
  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitStatus, setVisitStatus] = useState<VisitStatus>('first_time');
  const [invitedBy, setInvitedBy] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');
  const [wantsPastoralCall, setWantsPastoralCall] = useState(false);
  const [branchId, setBranchId] = useState(userBranchId(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lastRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);

  const branchList = branches.data ?? [];
  const effectiveBranchId = branchId || (branchList.length === 1 ? branchList[0]._id : '');

  async function save() {
    if (!definition.data) {
      setFormError(fieldsText('loadFailed'));
      void definition.refresh();
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = t('firstNameRequired');
    if (!lastName.trim()) nextErrors.lastName = t('lastNameRequired');
    if (phone.replace(/\D/g, '').length < 7) nextErrors.phone = t('phoneRequired');
    if (visible('email') && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = t('emailInvalid');
    for (const field of definition.data.fields) {
      if (field.required && !custom[field.key]?.trim()) nextErrors[field.key] = fieldsText('required');
    }
    if (pickBranch && !effectiveBranchId) nextErrors.branch = t('branchRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setFormError(null);
    try {
      const guest = await api.post<GuestDetail>('/guests', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        ...(visible('email') && email.trim() ? { email: email.trim().toLowerCase() } : {}),
        ...(visible('invitedBy') && invitedBy.trim() ? { invitedBy: invitedBy.trim() } : {}),
        ...(visible('prayerRequest') && prayerRequest.trim() ? { prayerRequest: prayerRequest.trim() } : {}),
        ...(visible('wantsPastoralCall') ? { wantsPastoralCall } : {}),
        formRevision: definition.data.revision,
        customFields: Object.fromEntries(definition.data.fields.flatMap((field) => {
          const value = custom[field.key]?.trim();
          return value ? [[field.key, field.type === 'number' ? Number(value) : value]] : [];
        })),
        visitStatus,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      });
      void refreshAlerts();
      toast.success(t('registered', { name: guest.firstName }));
      router.replace(`/guest/${guest._id}`);
    } catch (error) {
      setFormError(error instanceof NetworkError ? t('offline') : errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen safeTop={false} footer={<Button label={t('submit')} size="lg" loading={saving} onPress={() => void save()} />}>
        <Stack.Screen options={{ title: t('title') }} />
        <Caption>{t('intro')}</Caption>

        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <View style={styles.chips}>
          <Chip label={t('firstTime')} selected={visitStatus === 'first_time'} onPress={() => setVisitStatus('first_time')} />
          <Chip label={t('beenBefore')} selected={visitStatus === 'returned'} onPress={() => setVisitStatus('returned')} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label={common('fields.firstName')}
              required
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
              onSubmitEditing={() => lastRef.current?.focus()}
              error={errors.firstName}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              ref={lastRef}
              label={common('fields.lastName')}
              required
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              error={errors.lastName}
            />
          </View>
        </View>

        <Field
          ref={phoneRef}
          label={common('fields.phone')}
          required
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t('phonePlaceholder')}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={errors.phone}
          hint={t('phoneHint')}
        />
        {visible('email') ? <Field
          ref={emailRef}
          label={common('fields.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
        /> : null}

        {pickBranch ? (
          <View style={{ gap: space.sm }}>
            <Section title={common('fields.branch')} />
            {errors.branch ? <Text style={[type.small, { color: colors.danger }]}>{errors.branch}</Text> : null}
            <View style={styles.chips}>
              {branchList.map((branch) => (
                <Chip key={branch._id} label={branch.name} selected={effectiveBranchId === branch._id} onPress={() => setBranchId(branch._id)} />
              ))}
              {branches.loading ? <Caption>{t('loadingBranches')}</Caption> : null}
            </View>
          </View>
        ) : null}

        {visible('invitedBy') ? <Field label={t('invitedBy')} value={invitedBy} onChangeText={setInvitedBy} placeholder={t('invitedByPlaceholder')} autoCapitalize="words" /> : null}
        {visible('prayerRequest') ? <Field label={t('prayerRequest')} value={prayerRequest} onChangeText={setPrayerRequest} placeholder={t('prayerRequestPlaceholder')} multiline /> : null}
        {definition.data?.fields.map((field) => {
          const label = (locale === 'es' && field.labelEs) || (locale === 'fr' && field.labelFr) || (locale === 'pt' && field.labelPt) || field.label;
          const value = custom[field.key] ?? '';
          const change = (answer: string) => setCustom((current) => ({ ...current, [field.key]: answer }));
          return field.type === 'select' ? (
            <View key={field.key} style={{ gap: space.sm }}>
              <Text style={type.label}>{label}{field.required ? ' *' : ''}</Text>
              {errors[field.key] ? <Text style={[type.small, { color: colors.danger }]}>{errors[field.key]}</Text> : null}
              <View style={styles.chips}>
                {field.options.map((option) => <Chip key={option} label={option} selected={value === option} onPress={() => change(value === option ? '' : option)} />)}
              </View>
            </View>
          ) : (
            <Field key={field.key} label={label} required={field.required} value={value} onChangeText={change}
              error={errors[field.key]} multiline={field.type === 'textarea'} maxLength={field.type === 'textarea' ? 2000 : 250}
              keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'tel' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'} />
          );
        })}

        {visible('wantsPastoralCall') ? <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{t('wantsCall')}</Text>
            <Caption>{t('wantsCallHint')}</Caption>
          </View>
          <Switch
            value={wantsPastoralCall}
            onValueChange={(value) => {
              tap();
              setWantsPastoralCall(value);
            }}
            trackColor={{ true: colors.flame, false: '#dedbd4' }}
            thumbColor="#ffffff"
          />
        </View> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
});
