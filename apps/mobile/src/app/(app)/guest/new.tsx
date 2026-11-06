import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, Field, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
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
    if (!firstName.trim()) nextErrors.firstName = 'Add a first name.';
    if (!lastName.trim()) nextErrors.lastName = 'Add a last name.';
    if (phone.replace(/\D/g, '').length < 7) nextErrors.phone = 'Add a phone number so the team can follow up.';
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'That email doesn’t look right.';
    if (pickBranch && !effectiveBranchId) nextErrors.branch = 'Choose the branch they visited.';
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
      toast.success(`${guest.firstName} is registered. Follow-up has started.`);
      router.replace(`/guest/${guest._id}`);
    } catch (error) {
      setFormError(
        error instanceof NetworkError
          ? 'No connection. Guests need a connection to register, so the team is alerted straight away.'
          : errorMessage(error),
      );
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen safeTop={false} footer={<Button label="Register guest" size="lg" loading={saving} onPress={() => void save()} />}>
        <Caption>Their follow-up starts as soon as you save, and the branch team gets an alert.</Caption>

        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <View style={styles.chips}>
          <Chip label="First time here" selected={visitStatus === 'first_time'} onPress={() => setVisitStatus('first_time')} />
          <Chip label="Been here before" selected={visitStatus === 'returned'} onPress={() => setVisitStatus('returned')} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field
              label="First name"
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
              label="Last name"
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
          label="Phone"
          required
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="+1 713 555 0101"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={errors.phone}
          hint="Used for calls, texts and WhatsApp follow-up."
        />
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
        />

        {pickBranch ? (
          <View style={{ gap: space.sm }}>
            <Section title="Branch" />
            {errors.branch ? <Text style={[type.small, { color: colors.danger }]}>{errors.branch}</Text> : null}
            <View style={styles.chips}>
              {branchList.map((branch) => (
                <Chip key={branch._id} label={branch.name} selected={effectiveBranchId === branch._id} onPress={() => setBranchId(branch._id)} />
              ))}
              {branches.loading ? <Caption>Loading branches…</Caption> : null}
            </View>
          </View>
        ) : null}

        <Field label="Invited by" value={invitedBy} onChangeText={setInvitedBy} placeholder="Who brought them?" autoCapitalize="words" />
        <Field
          label="Prayer request"
          value={prayerRequest}
          onChangeText={setPrayerRequest}
          placeholder="Anything they'd like the church to pray about"
          multiline
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Would like a call from a pastor</Text>
            <Caption>The pastors see this on their follow-up list.</Caption>
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
