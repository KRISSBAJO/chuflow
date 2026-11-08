import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { KeyValue, Sheet } from '@/components/kit';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Caption, ErrorState, Loading, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { branchName, dialable, statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { memberDisplayName, useMemberLabels } from './labels';
import { MemberFields, validateMember, type MemberFormErrors, type MemberFormValues } from './member-fields';
import { MEMBER_COURSES, memberGroupIds, memberGroupNames, yesNo, type MemberDetail, type MembershipStatus, type ServiceUnitSummary } from './types';
import { CustomMemberFields, memberFormPayload, type MemberFormDefinition } from './custom-member-fields';

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.55 }]}
    >
      <View style={styles.quickIcon}>
        <Icon name={icon} size={17} color={colors.ink} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function formValues(member: MemberDetail): MemberFormValues {
  return {
    title: member.title ?? '',
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone ?? '',
    email: member.email ?? '',
    membershipStatus: (['active', 'new_member', 'worker', 'inactive'].includes(member.membershipStatus) ? member.membershipStatus : 'active') as MembershipStatus,
    dateJoinedChurch: member.dateJoinedChurch ?? '',
    serviceUnitIds: memberGroupIds(member),
    familyDetails: member.familyDetails ?? '',
    branchId: member.branchId?._id ?? '',
  };
}

/** A member's profile: GET /members/:id, with an Edit sheet that PATCHes the basics. */
export function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('members.profile');
  const tf = useT('members.form');
  const tl = useT('members.list');
  const tc = useT('common');
  const labels = useMemberLabels();
  const format = useAppFormat();
  const { user } = useSession();
  const member = useApi<MemberDetail>(`/members/${id}`);
  const definition = useApi<MemberFormDefinition>(can.members(user?.role) ? '/members/staff-form' : null);
  const [custom, setCustom] = useState<Record<string, string | number>>({});

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MemberFormValues | null>(null);
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (member.loading) return <Loading />;
  if (member.error || !member.data) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <ErrorState message={member.error ?? t('notFound')} onRetry={() => void member.refresh()} />
      </Screen>
    );
  }

  const person = member.data;
  const isChild = person.recordType === 'child';
  const canEdit = can.members(user?.role) && !isChild;
  const phone = dialable(person.phone);
  const name = memberDisplayName(labels, person, tc('state.unnamed'));
  const groups = memberGroupNames(person);
  const origin = person.guestId && typeof person.guestId === 'object' ? [person.guestId.firstName, person.guestId.lastName].filter(Boolean).join(' ') : '';
  const knownUnits: ServiceUnitSummary[] = (Array.isArray(person.serviceUnitIds) ? person.serviceUnitIds : person.serviceUnitId ? [person.serviceUnitId] : [])
    .filter((unit): unit is { _id: string; name: string } => !!unit?._id && !!unit.name)
    .map((unit) => ({ _id: unit._id, name: unit.name, isActive: true }));

  function openEdit() {
    setDraft(formValues(person));
    setCustom(Object.fromEntries((person.customAnswers ?? []).map(({ key, value }) => [key, value])));
    setErrors({});
    setFormError(null);
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    if (!definition.data) {
      setFormError(tf('customLoadFailed'));
      void definition.refresh();
      return;
    }
    const nextErrors = validateMember(draft, tf, { identity: true, needsBranch: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.patch<MemberDetail>(`/members/${person._id}`, {
        ...memberFormPayload(definition.data, custom),
        title: draft.title || undefined,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim().toLowerCase() || undefined,
        membershipStatus: draft.membershipStatus,
        dateJoinedChurch: draft.dateJoinedChurch.trim() || undefined,
        familyDetails: draft.familyDetails.trim() || undefined,
        serviceUnitIds: draft.serviceUnitIds,
      });
      member.setData(() => updated);
      toast.success(t('saved'));
      setEditing(false);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const copyPhone = () => {
    if (!person.phone) return;
    void Clipboard.setStringAsync(person.phone).then(() => toast.success(t('copiedPhone')));
  };

  const details = [
    { label: t('holdToCopy'), value: person.phone, onPress: copyPhone },
    { label: tc('fields.email'), value: person.email },
    { label: t('membershipStatus'), value: labels.membershipStatus(person.membershipStatus) },
    { label: t('memberTitle'), value: labels.title(person.title) },
    { label: t('dateJoined'), value: person.dateJoinedChurch ? format.date(person.dateJoinedChurch) : '' },
    { label: t('branch'), value: branchName(person.branchId) },
    { label: t('originGuest'), value: origin || t('directRecord') },
  ];

  const formation = [
    ...MEMBER_COURSES.map((course) => {
      const values = person as unknown as Record<string, string | undefined>;
      const state = yesNo(values[course.status]);
      const extra = [values[course.date] ? `${t('courseDate')}: ${format.date(values[course.date])}` : '', values[course.location] ? `${t('courseLocation')}: ${values[course.location]}` : '']
        .filter(Boolean)
        .join(' · ');
      return { key: course.key, label: labels.course(course.key), state, text: labels.yesNo(values[course.status]), extra };
    }),
    { key: 'holySpirit', label: t('holyGhostBaptism'), state: yesNo(person.holySpiritBaptismStatus), text: labels.yesNo(person.holySpiritBaptismStatus), extra: '' },
    { key: 'water', label: t('waterBaptism'), state: yesNo(person.waterBaptismStatus), text: labels.yesNo(person.waterBaptismStatus), extra: '' },
  ];

  return (
    <Screen safeTop={false} refreshing={member.refreshing} onRefresh={() => void member.refresh()} contentStyle={{ gap: space.xl }}>
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.hero}>
        <Avatar person={person} size={56} />
        <Text style={[type.display, { fontSize: 21, textAlign: 'center' }]}>{name}</Text>
        <View style={styles.badges}>
          <Badge label={labels.membershipStatus(person.membershipStatus)} tone={statusTone(person.membershipStatus)} />
          {isChild ? <Badge label={tl('child')} tone="info" /> : null}
        </View>
        <Caption>{[branchName(person.branchId), person.createdAt ? t('added', { date: format.shortDate(person.createdAt).toLowerCase() }) : null].filter(Boolean).join(' · ')}</Caption>
      </View>

      {phone || person.email ? (
        <View style={styles.quickRow}>
          {phone ? <QuickAction icon="phone" label={tc('actions.call')} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          {phone ? <QuickAction icon="whatsapp" label={tc('actions.whatsapp')} onPress={() => void Linking.openURL(`https://wa.me/${phone.replace('+', '')}`)} /> : null}
          {phone ? <QuickAction icon="message" label={tc('actions.text')} onPress={() => void Linking.openURL(`sms:${phone}`)} /> : null}
          {person.email ? <QuickAction icon="mail" label={tc('actions.email')} onPress={() => void Linking.openURL(`mailto:${person.email}`)} /> : null}
        </View>
      ) : null}

      {isChild ? <Notice tone="info" icon="baby">{t('childRecord')}</Notice> : null}

      <View style={styles.actions}>
        {canEdit ? <Button label={tc('actions.edit')} icon="edit" variant="secondary" size="sm" onPress={openEdit} /> : null}
        {can.careCases(user?.role) ? (
          <Button
            label={t('openCare')}
            icon="care"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/care-cases?q=${encodeURIComponent(`${person.firstName} ${person.lastName}`)}` as Href)}
          />
        ) : null}
      </View>

      <View>
        <Section title={t('details')} />
        <KeyValue rows={details} />
      </View>
      {person.customAnswers?.length ? <View>
        <Section title={tf('customAnswers')} />
        <KeyValue rows={person.customAnswers.map(({ label, value }) => ({ label, value: String(value) }))} />
      </View> : null}

      <View>
        <Section title={t('formation')} />
        {formation.map((row, index) => (
          <View key={row.key} style={[styles.formationRow, index > 0 && styles.divider]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type.label}>{row.label}</Text>
              {row.extra ? <Caption numberOfLines={2}>{row.extra}</Caption> : null}
            </View>
            <Badge label={row.text} tone={row.state === 'yes' ? 'success' : 'neutral'} />
          </View>
        ))}
      </View>

      <View>
        <Section title={t('serviceGroups')} />
        {groups ? (
          <View style={styles.chips}>
            {groups.split('; ').map((group) => (
              <Badge key={group} label={group} tone="info" />
            ))}
          </View>
        ) : (
          <Caption>{t('noGroups')}</Caption>
        )}
      </View>

      <View>
        <Section title={t('family')} />
        <Text style={type.body}>{person.familyDetails || t('noFamily')}</Text>
      </View>

      <Caption style={{ textAlign: 'center' }}>
        {t('memberId')}: {person._id}
      </Caption>

      <Sheet
        visible={editing}
        onClose={() => (saving ? undefined : setEditing(false))}
        title={t('editTitle')}
        footer={<Button label={tc('actions.save')} size="lg" loading={saving} onPress={() => void save()} />}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
            {formError ? <Notice tone="danger">{formError}</Notice> : null}
            {draft ? <MemberFields value={draft} onChange={setDraft} errors={errors} knownUnits={knownUnits} hidden={definition.data?.hiddenStaff} /> : null}
            <CustomMemberFields form={definition.data ?? undefined} values={custom} onChange={setCustom} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  quick: { alignItems: 'center', gap: 5, minWidth: 56 },
  quickIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  formationRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
