import { useRef, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SheetPicker, type PickerOption } from '@/components/kit';
import { Chip, Field, Section } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { isoDay } from '@/lib/format';
import type { BranchSummary } from '@/lib/types';
import { useMemberLabels } from './labels';
import { ServiceUnitsPicker } from './service-units-picker';
import { isValidPastDay, MEMBERSHIP_STATUSES, MEMBER_TITLES, type MembershipStatus, type ServiceUnitSummary } from './types';

/* The editable member basics, shared by New member, Convert guest and the profile's Edit sheet. */

export type MemberFormValues = {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  membershipStatus: MembershipStatus;
  dateJoinedChurch: string;
  serviceUnitIds: string[];
  familyDetails: string;
  branchId: string;
};

export const EMPTY_MEMBER_FORM: MemberFormValues = {
  title: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  membershipStatus: 'active',
  dateJoinedChurch: '',
  serviceUnitIds: [],
  familyDetails: '',
  branchId: '',
};

export type MemberFormErrors = Partial<Record<keyof MemberFormValues, string>>;

export function MemberFields({
  value,
  onChange,
  errors,
  identity = true,
  branches,
  knownUnits,
  hidden = [],
}: {
  value: MemberFormValues;
  onChange: (next: MemberFormValues) => void;
  errors: MemberFormErrors;
  /** Hide the name/contact fields (convert carries them over from the guest). */
  identity?: boolean;
  /** When set, a branch picker is shown (multi-branch roles). */
  branches?: BranchSummary[] | null;
  knownUnits?: ServiceUnitSummary[];
  hidden?: string[];
}) {
  const t = useT('members.form');
  const labels = useMemberLabels();
  const lastRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const set = <K extends keyof MemberFormValues>(key: K, next: MemberFormValues[K]) => onChange({ ...value, [key]: next });

  const titleOptions: PickerOption<string>[] = [{ value: 'none', label: t('noTitle') }, ...MEMBER_TITLES.map((title) => ({ value: title, label: labels.title(title) }))];

  return (
    <>
      {branches ? (
        <SheetPicker
          label={t('branch')}
          required
          value={value.branchId}
          options={branches.map((branch) => ({ value: branch._id, label: branch.name, hint: [branch.city, branch.state].filter(Boolean).join(', ') || undefined }))}
          onChange={(branchId) => onChange({ ...value, branchId, serviceUnitIds: [] })}
          placeholder={t('chooseBranch')}
          error={errors.branchId}
        />
      ) : null}

      {identity ? (
        <>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field
                label={t('firstName')}
                required
                value={value.firstName}
                onChangeText={(text) => set('firstName', text)}
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
                label={t('lastName')}
                required
                value={value.lastName}
                onChangeText={(text) => set('lastName', text)}
                autoCapitalize="words"
                autoComplete="family-name"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                error={errors.lastName}
              />
            </View>
          </View>
          {!hidden.includes('phone') ? <Field
            ref={phoneRef}
            label={t('phone')}
            value={value.phone}
            onChangeText={(text) => set('phone', text)}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="+1 713 555 0101"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.phone}
          /> : null}
          {!hidden.includes('email') ? <Field
            ref={emailRef}
            label={t('email')}
            value={value.email}
            onChangeText={(text) => set('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="name@example.com"
            error={errors.email}
          /> : null}
        </>
      ) : null}

      {!hidden.includes('title') ? <SheetPicker label={t('memberTitle')} value={value.title || 'none'} options={titleOptions} onChange={(title) => set('title', title === 'none' ? '' : title)} /> : null}

      <View style={styles.group}>
        <Section title={t('membershipStatus')} />
        <View style={styles.chips}>
          {MEMBERSHIP_STATUSES.map((status) => (
            <Chip key={status} label={labels.membershipStatus(status)} selected={value.membershipStatus === status} onPress={() => set('membershipStatus', status)} />
          ))}
        </View>
      </View>

      {!hidden.includes('dateJoinedChurch') ? <View style={{ gap: space.sm }}>
        <Field
          label={t('dateJoined')}
          value={value.dateJoinedChurch}
          onChangeText={(text) => set('dateJoinedChurch', text.replace(/[^\d-]/g, '').slice(0, 10))}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          hint={t('dateHint')}
          error={errors.dateJoinedChurch}
        />
        <View style={styles.chips}>
          <Chip label={t('today')} selected={value.dateJoinedChurch === isoDay(new Date())} onPress={() => set('dateJoinedChurch', isoDay(new Date()))} icon="calendar" />
        </View>
      </View> : null}

      <ServiceUnitsPicker branchId={value.branchId} value={value.serviceUnitIds} onChange={(ids) => set('serviceUnitIds', ids)} known={knownUnits} />

      {!hidden.includes('familyDetails') ? <Field label={t('familyDetails')} value={value.familyDetails} onChangeText={(text) => set('familyDetails', text)} placeholder={t('familyPlaceholder')} multiline /> : null}
      {errors.branchId && !branches ? <Text style={[type.small, { color: colors.danger }]}>{errors.branchId}</Text> : null}
    </>
  );
}

/** Field-level checks shared by the forms; returns an empty object when everything is fine. */
export function validateMember(value: MemberFormValues, t: (key: string) => string, options: { identity: boolean; needsBranch: boolean }): MemberFormErrors {
  const errors: MemberFormErrors = {};
  if (options.identity) {
    if (!value.firstName.trim()) errors.firstName = t('errors.firstName');
    if (!value.lastName.trim()) errors.lastName = t('errors.lastName');
    if (value.phone.trim() && value.phone.replace(/\D/g, '').length < 7) errors.phone = t('errors.phone');
    if (value.email.trim() && !/^\S+@\S+\.\S+$/.test(value.email.trim())) errors.email = t('errors.email');
  }
  if (value.dateJoinedChurch.trim() && !isValidPastDay(value.dateJoinedChurch.trim())) errors.dateJoinedChurch = t('errors.date');
  if (options.needsBranch && !value.branchId) errors.branchId = t('errors.branch');
  return errors;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
