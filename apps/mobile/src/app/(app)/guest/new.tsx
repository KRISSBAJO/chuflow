import { router, Stack } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, Field, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
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
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = t('firstNameRequired');
    if (!lastName.trim()) nextErrors.lastName = t('lastNameRequired');
    if (phone.replace(/\D/g, '').length < 7) nextErrors.phone = t('phoneRequired');
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = t('emailInvalid');
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
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        ...(invitedBy.trim() ? { invitedBy: invitedBy.trim() } : {}),
        ...(prayerRequest.trim() ? { prayerRequest: prayerRequest.trim() } : {}),
        wantsPastoralCall,
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
        <Field
          ref={emailRef}
          label={common('fields.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
        />

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

        <Field label={t('invitedBy')} value={invitedBy} onChangeText={setInvitedBy} placeholder={t('invitedByPlaceholder')} autoCapitalize="words" />
        <Field label={t('prayerRequest')} value={prayerRequest} onChangeText={setPrayerRequest} placeholder={t('prayerRequestPlaceholder')} multiline />

        <View style={styles.switchRow}>
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
        </View>
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
