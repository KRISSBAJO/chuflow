import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, EmptyState, Notice, Screen } from '@/components/ui';
import { useT } from '@/i18n/provider';
import { api, errorMessage, NetworkError } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { EMPTY_MEMBER_FORM, MemberFields, validateMember, type MemberFormErrors, type MemberFormValues } from './member-fields';
import type { MemberDetail } from './types';

/** Adds a member: POST /members with the CreateMemberDto basics. */
export function NewMemberScreen() {
  const t = useT('members.form');
  const tm = useT('members');
  const { user } = useSession();
  const allowed = can.members(user?.role);
  const pickBranch = allowed && can.pickBranch(user?.role);
  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);

  const [value, setValue] = useState<MemberFormValues>({ ...EMPTY_MEMBER_FORM, branchId: userBranchId(user) });
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A single branch in scope needs no picking.
  const form: MemberFormValues = value.branchId || branches.data?.length !== 1 ? value : { ...value, branchId: branches.data[0]._id };

  async function save() {
    const value = form;
    const nextErrors = validateMember(value, t, { identity: true, needsBranch: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const member = await api.post<MemberDetail>('/members', {
        branchId: value.branchId,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        ...(value.title ? { title: value.title } : {}),
        ...(value.phone.trim() ? { phone: value.phone.trim() } : {}),
        ...(value.email.trim() ? { email: value.email.trim().toLowerCase() } : {}),
        membershipStatus: value.membershipStatus,
        ...(value.dateJoinedChurch.trim() ? { dateJoinedChurch: value.dateJoinedChurch.trim() } : {}),
        ...(value.serviceUnitIds.length ? { serviceUnitIds: value.serviceUnitIds } : {}),
        ...(value.familyDetails.trim() ? { familyDetails: value.familyDetails.trim() } : {}),
      });
      toast.success(t('created', { name: member.firstName }));
      router.replace(`/members/${member._id}` as Href);
    } catch (error) {
      setFormError(error instanceof NetworkError ? t('offline') : errorMessage(error));
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('newTitle') }} />
        <EmptyState icon="lock" title={tm('noAccess')} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen safeTop={false} footer={<Button label={t('save')} size="lg" loading={saving} onPress={() => void save()} />}>
        <Stack.Screen options={{ title: t('newTitle') }} />
        <Caption>{t('intro')}</Caption>
        {formError ? <Notice tone="danger">{formError}</Notice> : null}
        <MemberFields value={form} onChange={setValue} errors={errors} branches={pickBranch ? (branches.data ?? []) : null} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
