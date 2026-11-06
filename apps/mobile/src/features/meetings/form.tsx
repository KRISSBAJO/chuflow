import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { DateStepper, SheetPicker, SwitchRow } from '@/components/kit';
import { Avatar, Button, Caption, Card, Chip, EmptyState, ErrorState, Field, ListRow, Loading, Notice, Screen, Section } from '@/components/ui';
import { colors, fonts, space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { refId, refName, type AudienceMode, type MeetingOptions, type MeetingPerson, type ParticipantsResponse } from './types';

const CHURCH = '__church__';
const TIME_CHIPS = ['09:00', '10:00', '12:00', '18:00', '19:00'];
const pad = (n: number) => String(n).padStart(2, '0');

function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

function at(date: Date, minutes: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60);
}

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return d;
}

/** Schedules a meeting: details, then who is invited, mirroring the website's two-step form. */
export function MeetingForm() {
  const t = useT('meetings');
  const common = useT('common');
  const format = useAppFormat();
  const { user } = useSession();
  const allowed = can.meetings(user?.role);
  const options = useApi<MeetingOptions>(allowed ? '/meetings/options?mode=form' : null);
  const o = options.data;

  const [chosenGroup, setGroupId] = useState('');
  const [chosenBranch, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => defaultStart());
  const [start, setStart] = useState(() => {
    const d = defaultStart();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [end, setEnd] = useState(() => {
    const d = new Date(defaultStart().getTime() + 60 * 60_000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [location, setLocation] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [agenda, setAgenda] = useState('');
  const [audience, setAudience] = useState<AudienceMode>('individuals');
  const [units, setUnits] = useState<string[]>([]);
  const [members, setMembers] = useState<MeetingPerson[]>([]);
  const [staff, setStaff] = useState<MeetingPerson[]>([]);
  const [sendInvitations, setSendInvitations] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const groups = useMemo(() => (o?.groups ?? []).filter((g) => g.enabled), [o]);
  const groupOptions = useMemo(
    () => [
      ...(o?.isAdmin ? [{ value: CHURCH, label: t('form.churchGeneral') }] : []),
      ...groups.map((g) => ({ value: g._id, label: refName(g.branchId) ? t('form.groupOption', { name: g.name, branch: refName(g.branchId) }) : g.name })),
    ],
    [o, groups, t],
  );
  // Non-admins usually belong to one group; a single branch needs no picker either.
  const groupId = chosenGroup || (!o?.isAdmin && groupOptions[0]?.value) || '';
  const branchId = chosenBranch || (o?.branches.length === 1 ? o.branches[0]._id : '');
  const group = groups.find((g) => g._id === groupId);
  const church = groupId === CHURCH;
  const effectiveBranch = church ? branchId : refId(group?.branchId);
  const branchUnits = (o?.serviceUnits ?? []).filter((u) => !effectiveBranch || u.branchId === effectiveBranch);

  const startMin = parseTime(start);
  const endMin = parseTime(end);
  const startsAt = startMin === null ? null : at(date, startMin);
  const endsAt = endMin === null ? null : at(date, endMin);
  const timeError =
    startMin === null || endMin === null
      ? t('form.invalidTime')
      : startsAt && endsAt && endsAt <= startsAt
        ? t('form.endBeforeStart')
        : startsAt && startsAt < new Date()
          ? t('form.startInPast')
          : '';
  const titleValid = title.trim().length >= 2;
  const groupValid = !!groupId && (!church || !!branchId);
  const peopleValid = audience === 'church' || (audience === 'service_groups' ? units.length > 0 : members.length + staff.length > 0);
  const canSubmit = !busy && groupValid && titleValid && !timeError && peopleValid;

  async function submit() {
    setSubmitted(true);
    if (!canSubmit || !startsAt || !endsAt) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ _id: string }>('/meetings', {
        title: title.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        location: location.trim() || undefined,
        joinUrl: joinUrl.trim() || undefined,
        agenda: agenda.trim() || undefined,
        ...(church ? { branchId } : { groupId }),
        audienceMode: audience,
        audienceServiceUnitIds: audience === 'service_groups' ? units : [],
        attendeeMemberIds: audience === 'service_groups' ? [] : members.map((m) => m._id),
        attendeeUserIds: staff.map((s) => s._id),
        sendInvitations,
      });
      router.replace(`/meetings/${r._id}` as Href);
    } catch (e) {
      setError(errorMessage(e, t('form.saveFailed')));
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('form.title') }} />
        <EmptyState icon="lock" title={t('form.noAccess')} />
      </Screen>
    );
  }
  if (!o) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('form.title') }} />
        {options.loading ? <Loading /> : <ErrorState message={options.error ?? ''} onRetry={() => void options.refresh()} />}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        safeTop={false}
        footer={
          <View style={styles.footer}>
            <Caption numberOfLines={2} style={{ flex: 1 }}>
              {startsAt && endsAt && !timeError ? `${format.longDate(startsAt)} · ${start}–${end}` : t('form.pickTime')}
              {peopleValid ? ` · ${t('form.peopleSummary', { count: audience === 'church' ? 0 : members.length + staff.length, units: units.length, mode: audience })}` : ''}
            </Caption>
            <Button label={busy ? t('form.saving') : t('form.schedule')} loading={busy} disabled={submitted && !canSubmit} onPress={() => void submit()} />
          </View>
        }
      >
        <Stack.Screen options={{ title: t('form.title') }} />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {!groupOptions.length ? <Notice tone="warning">{t('form.needAdmin')}</Notice> : null}

        <Section title={t('form.step1')} />
        <SheetPicker label={t('form.group')} value={groupId} options={groupOptions} onChange={setGroupId} required placeholder={t('form.groupPlaceholder')} error={submitted && !groupId ? common('state.required') : undefined} />
        {church ? (
          <SheetPicker label={t('form.churchBranch')} value={branchId} options={o.branches.map((b) => ({ value: b._id, label: b.name }))} onChange={setBranchId} required error={submitted && !branchId ? common('state.required') : undefined} />
        ) : null}
        <Field label={t('form.meetingTitle')} required value={title} onChangeText={setTitle} placeholder={t('form.titlePlaceholder')} maxLength={200} error={submitted && !titleValid ? t('form.titleShort') : undefined} />

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{t('form.date')}</Text>
          <DateStepper value={date} min={new Date()} max={null} label={format.longDate(date)} onChange={setDate} />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={t('form.starts')} value={start} onChangeText={setStart} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} hint={t('form.timeHint')} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('form.ends')} value={end} onChangeText={setEnd} placeholder="19:00" keyboardType="numbers-and-punctuation" maxLength={5} error={timeError || undefined} />
          </View>
        </View>
        <View style={styles.chips}>
          {TIME_CHIPS.map((v) => (
            <Chip
              key={v}
              label={v}
              selected={start === v}
              onPress={() => {
                setStart(v);
                const min = parseTime(v)!;
                setEnd(`${pad(Math.floor((min + 60) / 60) % 24)}:${pad(min % 60)}`);
              }}
            />
          ))}
        </View>
        <Field label={t('form.location')} value={location} onChangeText={setLocation} placeholder={t('form.locationPlaceholder')} maxLength={300} />
        <Field label={t('form.link')} value={joinUrl} onChangeText={setJoinUrl} placeholder="https://" hint={t('form.linkHint')} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2000} />
        <Field label={t('form.agenda')} value={agenda} onChangeText={setAgenda} placeholder={t('form.agendaPlaceholder')} multiline numberOfLines={4} textAlignVertical="top" style={{ minHeight: 96 }} maxLength={10000} />

        <Section title={t('form.step2')} />
        <Text style={styles.label}>{t('form.audience')}</Text>
        <View style={styles.chips}>
          {(['individuals', 'service_groups', 'church'] as AudienceMode[]).map((mode) => (
            <Chip key={mode} label={t(`form.audience_${mode}`)} selected={audience === mode} onPress={() => setAudience(mode)} />
          ))}
        </View>
        {audience === 'service_groups' ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('form.serviceGroups')}</Text>
            {branchUnits.length ? (
              <View style={styles.chips}>
                {branchUnits.map((u) => (
                  <Chip key={u._id} label={u.name} selected={units.includes(u._id)} onPress={() => setUnits(units.includes(u._id) ? units.filter((x) => x !== u._id) : [...units, u._id])} />
                ))}
              </View>
            ) : (
              <Caption>{t('form.noServiceGroups')}</Caption>
            )}
            <Caption>{t('form.serviceGroupsHint')}</Caption>
            {submitted && !units.length ? <Text style={styles.error}>{t('form.pickServiceGroup')}</Text> : null}
          </View>
        ) : null}
        {audience === 'church' ? <Notice tone="info">{t('form.churchNote')}</Notice> : null}
        {audience !== 'service_groups' ? (
          <PeoplePicker kind="members" branchId={effectiveBranch} selected={members} onChange={setMembers} label={audience === 'church' ? t('form.addOtherMembers') : t('form.chooseMembers')} />
        ) : null}
        <PeoplePicker kind="staff" branchId={effectiveBranch} selected={staff} onChange={setStaff} label={t('form.staff')} hint={t('form.staffHint')} />
        {submitted && !peopleValid && audience === 'individuals' ? <Text style={styles.error}>{t('form.pickPeople')}</Text> : null}

        <Card padded={false}>
          <SwitchRow icon="mail" title={t('form.sendInvitations')} body={t('form.invitationsNote')} value={sendInvitations} onChange={setSendInvitations} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Search-as-you-type picker over `/meetings/participants`; chosen people show as chips. */
function PeoplePicker({ kind, branchId, selected, onChange, label, hint }: { kind: 'members' | 'staff'; branchId: string; selected: MeetingPerson[]; onChange: (next: MeetingPerson[]) => void; label: string; hint?: string }) {
  const t = useT('meetings.picker');
  const format = useAppFormat();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ term: string; data: ParticipantsResponse } | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const noun = t(`nouns.${kind}`);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || !branchId) return;
    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        const r = await api.get<ParticipantsResponse>(`/meetings/participants${query({ branchId, q: term, kind, page: 1 })}`);
        if (live) setFound({ term, data: r });
      } catch {
        if (live) setFailed(true);
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, branchId, kind]);

  const chosen = new Set(selected.map((p) => p._id));
  const results = found && found.term === q.trim() ? found.data : null;
  return (
    <View style={{ gap: space.sm }}>
      <Field label={label} value={q} onChangeText={setQ} placeholder={kind === 'staff' ? t('placeholderStaff') : t('placeholderMembers')} hint={hint ?? (!branchId ? t('pickGroupFirst') : t('hint', { noun }))} autoCorrect={false} editable={!!branchId} />
      {selected.length ? (
        <View style={styles.chips}>
          {selected.map((p) => (
            <Chip key={p._id} label={`${format.fullName(p)} ×`} selected onPress={() => onChange(selected.filter((x) => x._id !== p._id))} />
          ))}
        </View>
      ) : null}
      {searching ? <Caption>{t('searching')}</Caption> : null}
      {failed ? <Caption style={{ color: colors.danger }}>{t('searchFailed', { noun })}</Caption> : null}
      {results && !searching ? (
        results.items.length ? (
          <Card padded={false}>
            {results.items
              .filter((p) => !chosen.has(p._id))
              .map((p, i) => (
                <ListRow
                  key={p._id}
                  divider={i > 0}
                  title={format.fullName(p)}
                  subtitle={p.email || t('noEmail')}
                  left={<Avatar person={p} size={30} />}
                  chevron={false}
                  onPress={() => {
                    onChange([...selected, p]);
                    setQ('');
                  }}
                />
              ))}
            {results.total > results.items.length ? <Caption style={{ padding: space.md }}>{t('matchesRefine', { count: results.total })}</Caption> : null}
          </Card>
        ) : (
          <Caption>{t('noMatches', { noun })}</Caption>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  label: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  error: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.danger },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
