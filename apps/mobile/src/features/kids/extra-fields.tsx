import { useState } from 'react';
import { View } from 'react-native';
import { Button, Caption, Notice } from '@/components/ui';
import { space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { CustomMemberFields, memberFormPayload, type MemberFormDefinition } from '@/features/members/custom-member-fields';
import type { ChildProfile, Family } from './types';

export function KidsExtraFields({ family, child, onSaved }: { family: Family; child?: ChildProfile; onSaved: () => void }) {
  const tf = useT('members.form');
  const t = useT('common.actions');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const record = child ?? family;
  const definition = useApi<MemberFormDefinition>(editing ? '/guests/ministry-form/' + (child ? 'child' : 'family') : null);
  const [values, setValues] = useState<Record<string, string | number>>({});

  async function save() {
    if (!definition.data) return;
    setSaving(true);
    setError('');
    const answers = memberFormPayload(definition.data, values);
    try {
      if (child) {
        const { firstName, lastName, birthDate, guardianIds, pickupGuardianIds, careNotes, pickupNotes, photoConsent, photoUrl, isMember, isActive } = child;
        await api.patch(`/children/profiles/${child._id}`, {
          familyId: family._id, expectedRevision: child.revision, firstName, lastName, birthDate,
          guardianIds, pickupGuardianIds, careNotes, pickupNotes, photoConsent, photoUrl, isMember, isActive, ...answers,
        });
      } else {
        await api.patch(`/children/families/${family._id}`, {
          branchId: family.branchId, name: family.name, guardians: family.guardians, expectedRevision: family.revision, ...answers,
        });
      }
      setEditing(false);
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {editing ? (
        <>
          {definition.error ? <Notice tone="danger">{tf('extraLoadFailed')}</Notice> : null}
          <CustomMemberFields form={definition.data ?? undefined} values={values} onChange={setValues} title={tf('extraAnswers')} />
          {definition.data?.fields.length === 0 ? <Caption>{tf('noExtraFields')}</Caption> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button size="sm" variant="secondary" label={t('cancel')} onPress={() => setEditing(false)} />
            <Button size="sm" label={t('save')} loading={saving} disabled={!definition.data?.fields.length} onPress={() => void save()} />
          </View>
        </>
      ) : (
        <Button size="sm" variant="ghost" label={tf('editExtraFields')} onPress={() => {
          setValues(Object.fromEntries((record.customAnswers ?? []).map(({ key, value }) => [key, value])));
          setError('');
          setEditing(true);
        }} />
      )}
    </View>
  );
}
