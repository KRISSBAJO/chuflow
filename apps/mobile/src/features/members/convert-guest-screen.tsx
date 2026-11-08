import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Caption, EmptyState, ErrorState, Loading, Notice, Screen } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage, NetworkError } from '@/lib/api';
import { statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { GuestDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { EMPTY_MEMBER_FORM, MemberFields, validateMember, type MemberFormErrors, type MemberFormValues } from './member-fields';
import type { MemberDetail } from './types';
import { CustomMemberFields, memberFormPayload, type MemberFormDefinition } from './custom-member-fields';

/**
 * Converts a guest into a member: POST /members/convert/:guestId carries the name and contact
 * details over; anything else chosen here is then PATCHed onto the new member.
 */
export function ConvertGuestScreen() {
  const { guestId } = useLocalSearchParams<{ guestId?: string }>();
  const t = useT('members.form');
  const tm = useT('members');
  const { user } = useSession();
  const allowed = can.convertGuests(user?.role);
  const guest = useApi<GuestDetail>(allowed && guestId ? `/guests/${guestId}` : null);

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('convertTitle') }} />
        <EmptyState icon="lock" title={tm('noAccess')} />
      </Screen>
    );
  }
  if (!guestId || guest.error || (!guest.loading && !guest.data)) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('convertTitle') }} />
        <ErrorState message={guest.error ?? t('guestNotFound')} onRetry={guestId ? () => void guest.refresh() : undefined} />
      </Screen>
    );
  }
  if (guest.loading || !guest.data) return <Loading />;

  return <ConvertForm guest={guest.data} />;
}

function ConvertForm({ guest }: { guest: GuestDetail }) {
  const t = useT('members.form');
  const definition = useApi<MemberFormDefinition>(`/members/convert/${guest._id}/form`);
  const [custom, setCustom] = useState<Record<string, string | number>>({});
  const format = useAppFormat();
  const [value, setValue] = useState<MemberFormValues>(() => ({
    ...EMPTY_MEMBER_FORM,
    firstName: guest.firstName,
    lastName: guest.lastName,
    phone: guest.phone ?? '',
    email: guest.email ?? '',
    branchId: guest.branchId?._id ?? '',
  }));
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const alreadyMember = guest.convertedToMember || guest.visitStatus === 'member';

  async function convert() {
    if (!definition.data) {
      setFormError(t('customLoadFailed'));
      void definition.refresh();
      return;
    }
    const nextErrors = validateMember(value, t, { identity: false, needsBranch: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.post<MemberDetail>(`/members/convert/${guest._id}`, memberFormPayload(definition.data, custom));
      const extras = {
        ...(value.title ? { title: value.title } : {}),
        ...(value.membershipStatus !== 'active' ? { membershipStatus: value.membershipStatus } : {}),
        ...(value.dateJoinedChurch.trim() ? { dateJoinedChurch: value.dateJoinedChurch.trim() } : {}),
        ...(value.serviceUnitIds.length ? { serviceUnitIds: value.serviceUnitIds } : {}),
        ...(value.familyDetails.trim() ? { familyDetails: value.familyDetails.trim() } : {}),
      };
      if (Object.keys(extras).length) {
        try {
          await api.patch(`/members/${created._id}`, extras);
        } catch (error) {
          // The member exists; the extras can be edited on the profile.
          toast.error(errorMessage(error));
        }
      }
      toast.success(t('converted', { name: created.firstName }));
      router.replace(`/members/${created._id}` as Href);
    } catch (error) {
      setFormError(error instanceof NetworkError ? t('offline') : errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen safeTop={false} footer={<Button label={t('convert')} variant="flame" size="lg" loading={saving} disabled={alreadyMember} onPress={() => void convert()} />}>
        <Stack.Screen options={{ title: t('convertTitle') }} />
        <Caption>{t('convertIntro')}</Caption>

        <View style={styles.guest}>
          <Avatar person={guest} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.micro}>{t('guest').toUpperCase()}</Text>
            <Text style={type.title} numberOfLines={1}>
              {format.fullName(guest)}
            </Text>
            <Caption numberOfLines={1}>{[guest.phone, guest.email].filter(Boolean).join(' · ')}</Caption>
          </View>
          <Badge label={format.status(guest.visitStatus)} tone={statusTone(guest.visitStatus)} />
        </View>

        {alreadyMember ? <Notice tone="warning">{t('alreadyMember')}</Notice> : null}
        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <MemberFields value={value} onChange={setValue} errors={errors} identity={false} hidden={definition.data?.hiddenStaff} />
        <CustomMemberFields form={definition.data ?? undefined} values={custom} onChange={setCustom} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  guest: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
});
