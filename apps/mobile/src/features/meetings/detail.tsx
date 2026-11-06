import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Banner, KeyValue } from '@/components/kit';
import { Avatar, Badge, Body, Button, Caption, Card, ErrorState, Field, Heading, ListRow, Loading, Notice, Screen, Section } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useApi } from '@/lib/use-api';
import { minutesLabel, MINUTES_TONE, STATUS_TONE, statusLabel } from './shared';
import { refName, type Meeting, type MeetingPerson } from './types';

type Patch = Record<string, unknown> & { operation: 'details' | 'attendance' | 'minutes' | 'submit' | 'approve' | 'return' };

/** One meeting: when and where, who is invited, invitations, minutes and status actions. */
export function MeetingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('meetings');
  const format = useAppFormat();
  const meeting = useApi<Meeting>(`/meetings/${id}`);
  const m = meeting.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [minutes, setMinutes] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  async function patch(body: Patch, success?: string) {
    if (!m) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api.patch<Meeting>(`/meetings/${m._id}`, { ...body, expectedRevision: m.revision });
      meeting.setData(() => ({ ...m, ...updated }));
      await meeting.reload();
      if (success) toast.success(success);
    } catch (e) {
      setError(errorMessage(e, t('details.saveFailed')));
      void meeting.reload();
    } finally {
      setBusy(false);
    }
  }

  async function retryInvitations() {
    if (!m) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/meetings/${m._id}/invitations/retry`, {});
      toast.success(t('details.retryQueued'));
      await meeting.reload();
    } catch (e) {
      setError(errorMessage(e, t('details.saveFailed')));
    } finally {
      setBusy(false);
    }
  }

  if (!m) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('details.title') }} />
        {meeting.loading ? <Loading /> : <ErrorState message={meeting.error ?? ''} onRetry={() => void meeting.refresh()} />}
      </Screen>
    );
  }

  const presentUsers = new Set(m.presentUserIds);
  const presentMembers = new Set(m.presentMemberIds ?? []);
  const people: { person: MeetingPerson; kind: 'staff' | 'member'; present: boolean }[] = [
    ...m.attendeeUsers.map((person) => ({ person, kind: 'staff' as const, present: presentUsers.has(person._id) })),
    ...m.attendeeMembers.map((person) => ({ person, kind: 'member' as const, present: presentMembers.has(person._id) })),
  ];
  const presentCount = people.filter((p) => p.present).length;
  const invitations = m.invitationSummary;
  const failed = invitations?.counts?.failed ?? 0;
  const minutesText = minutes ?? m.minutesBody ?? '';
  const minutesEditable = m.canManage && !['submitted', 'approved'].includes(m.minutesStatus) && m.status !== 'cancelled';
  const minutesBadge = minutesLabel(t, m);
  const website = (suffix = '') => void WebBrowser.openBrowserAsync(`${WEB_URL}/meetings/${m._id}${suffix}`);

  function togglePresent(entry: (typeof people)[number]) {
    const users = new Set(presentUsers);
    const members = new Set(presentMembers);
    const set = entry.kind === 'staff' ? users : members;
    if (set.has(entry.person._id)) set.delete(entry.person._id);
    else set.add(entry.person._id);
    void patch({ operation: 'attendance', presentUserIds: [...users], presentMemberIds: [...members] });
  }

  const statusActions: { status: Meeting['status']; label: string; variant: 'primary' | 'secondary' | 'danger' }[] =
    m.status === 'scheduled'
      ? [
          { status: 'ongoing', label: t('details.start'), variant: 'primary' },
          { status: 'cancelled', label: t('details.cancel'), variant: 'danger' },
        ]
      : m.status === 'ongoing'
        ? [
            { status: 'completed', label: t('details.complete'), variant: 'primary' },
            { status: 'cancelled', label: t('details.cancel'), variant: 'danger' },
          ]
        : [{ status: 'scheduled', label: t('details.reopenScheduled'), variant: 'secondary' }];

  return (
    <Screen safeTop={false} refreshing={meeting.refreshing} onRefresh={() => void meeting.refresh()}>
      <Stack.Screen options={{ title: t('details.title') }} />
      <View style={{ gap: 6 }}>
        <View style={styles.badges}>
          <Badge label={statusLabel(t, m.status)} tone={STATUS_TONE[m.status] ?? 'neutral'} />
          {minutesBadge ? <Badge label={minutesBadge} tone={MINUTES_TONE[m.minutesOverdue ? 'overdue' : m.minutesStatus] ?? 'neutral'} /> : null}
        </View>
        <Heading>{m.title}</Heading>
        <Caption>{refName(m.groupId) || m.group?.name || refName(m.branchId)}</Caption>
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {m.minutesOverdue ? <Banner tone="danger" icon="alert" title={t('minutesStatuses.overdue')} body={t('details.minutesDue', { date: format.dateTime(m.minutesDueAt) })} /> : null}

      <KeyValue
        rows={[
          { label: t('details.when'), value: `${format.longDate(m.startsAt)} · ${format.time(m.startsAt)} – ${format.time(m.endsAt)}` },
          { label: t('details.where'), value: m.location || (m.joinUrl ? t('details.online') : t('details.toBeConfirmed')) },
          ...(m.joinUrl ? [{ label: t('details.link'), value: m.joinUrl, onPress: () => void Linking.openURL(m.joinUrl) }] : []),
          { label: t('details.attendanceLabel'), value: t('details.markedPresent', { count: presentCount, total: people.length }) },
          { label: t('details.minutesLabel'), value: `${m.minutesRequired ? t('details.minutesRequired') : t('details.minutesOptional')}${m.minutesRequired && m.minutesDueAt ? ` · ${t('details.due', { date: format.dateTime(m.minutesDueAt) })}` : ''}` },
          ...(m.actions?.length ? [{ label: t('details.openActions'), value: String(m.actions.filter((a) => a.status === 'open').length) }] : []),
        ]}
      />
      {m.joinUrl ? <Button label={t('details.join')} icon="arrowUpRight" variant="secondary" onPress={() => void Linking.openURL(m.joinUrl)} /> : null}

      {m.canManage && m.status !== 'completed' ? (
        <View style={styles.actions}>
          {statusActions.map((a) => (
            <Button key={a.status} label={a.label} variant={a.variant} size="sm" disabled={busy} onPress={() => void patch({ operation: 'details', status: a.status }, t('details.saved'))} />
          ))}
        </View>
      ) : m.canManage ? (
        <View style={styles.actions}>
          <Button label={t('details.reopenScheduled')} variant="secondary" size="sm" disabled={busy} onPress={() => void patch({ operation: 'details', status: 'scheduled' }, t('details.saved'))} />
        </View>
      ) : null}

      <Section title={t('details.agenda')} />
      {m.agenda?.trim() ? <Body>{m.agenda}</Body> : <Caption>{t('details.noAgenda')}</Caption>}

      <Section title={t('details.peopleTitle')} />
      {people.length ? (
        <Card padded={false}>
          {people.map((p, i) => (
            <ListRow
              key={`${p.kind}-${p.person._id}`}
              divider={i > 0}
              title={format.fullName(p.person)}
              subtitle={[p.kind === 'staff' ? t('details.staff') : t('details.member'), p.person.email || t('picker.noEmail')].join(' · ')}
              left={<Avatar person={p.person} />}
              right={<Badge label={p.present ? t('details.present') : t('details.invited')} tone={p.present ? 'success' : 'neutral'} />}
              chevron={false}
              onPress={m.canManage && !busy ? () => togglePresent(p) : undefined}
            />
          ))}
        </Card>
      ) : (
        <Caption>{t('details.noPeople')}</Caption>
      )}
      {m.canManage && people.length ? <Caption>{t('details.attendanceHint')}</Caption> : null}

      <Section title={t('details.invitations')} />
      {!m.invitationsRequested ? (
        <Caption>{t('details.invitationsOff')}</Caption>
      ) : invitations ? (
        <Card style={{ gap: space.sm }}>
          <KeyValue
            rows={[
              { label: t('details.emailAddresses'), value: String(invitations.uniqueEmails) },
              { label: t('details.sentToProvider'), value: String(invitations.counts?.sent ?? 0) },
              { label: t('details.pending'), value: String(invitations.counts?.pending ?? 0) },
              ...(invitations.missingEmail ? [{ label: t('details.noValidEmail'), value: String(invitations.missingEmail) }] : []),
            ]}
          />
          {!invitations.prepared ? <Caption>{t('details.preparing')}</Caption> : null}
          {failed ? (
            <>
              <Notice tone="warning">{t('details.failedEmails', { count: failed })}</Notice>
              {m.canManage ? <Button label={t('details.retryUnsent')} icon="send" variant="secondary" size="sm" loading={busy} onPress={() => void retryInvitations()} /> : null}
            </>
          ) : null}
        </Card>
      ) : (
        <Caption>{t('details.preparing')}</Caption>
      )}

      <Section title={t('details.minutesTitle')} />
      {m.reviewComment ? <Notice tone="warning">{t('details.reviewer', { comment: m.reviewComment })}</Notice> : null}
      {minutesEditable ? (
        <View style={{ gap: space.sm }}>
          <Field label={t('details.bodyLabel')} value={minutesText} onChangeText={setMinutes} placeholder={t('details.bodyPlaceholder')} multiline numberOfLines={6} style={styles.multiline} textAlignVertical="top" />
          <View style={styles.actions}>
            <Button label={t('details.saveDraft')} size="sm" variant="secondary" disabled={busy || minutes === null || minutes === m.minutesBody} onPress={() => void patch({ operation: 'minutes', minutesBody: minutesText }, t('details.saved')).then(() => setMinutes(null))} />
            {['draft', 'changes_requested'].includes(m.minutesStatus) && m.status !== 'cancelled' ? (
              <Button label={t('details.submit')} size="sm" disabled={busy || minutes !== null} onPress={() => void patch({ operation: 'submit' }, t('details.saved'))} />
            ) : null}
          </View>
          <Caption>{t('details.submitNote')}</Caption>
        </View>
      ) : m.minutesBody?.trim() ? (
        <Body>{m.minutesBody}</Body>
      ) : (
        <Caption>{t('details.noMinutes')}</Caption>
      )}
      {m.minutesLinks?.length ? (
        <View style={{ gap: 6 }}>
          {m.minutesLinks.map((link, i) => (
            <Text key={link + i} style={styles.link} onPress={() => void Linking.openURL(link)}>
              {t('details.openLink', { n: i + 1 })}
            </Text>
          ))}
        </View>
      ) : null}
      {m.canReview && m.minutesStatus === 'submitted' ? (
        <Card style={{ gap: space.sm }}>
          <Text style={type.label}>{t('details.reviewNotes')}</Text>
          <Field label={t('details.reviewNotes')} value={reviewComment} onChangeText={setReviewComment} multiline numberOfLines={3} style={styles.multiline} textAlignVertical="top" />
          <View style={styles.actions}>
            <Button label={t('details.approve')} size="sm" disabled={busy} onPress={() => void patch({ operation: 'approve', reviewComment }, t('details.saved'))} />
            <Button label={t('details.requestChanges')} size="sm" variant="danger" disabled={busy || !reviewComment.trim()} onPress={() => void patch({ operation: 'return', reviewComment }, t('details.saved'))} />
          </View>
        </Card>
      ) : null}

      {m.files?.length ? (
        <>
          <Section title={t('details.documents')} />
          <Card padded={false}>
            {m.files.map((f, i) => (
              <ListRow key={f._id} divider={i > 0} title={f.name} subtitle={t('details.fileSize', { size: Math.max(1, Math.round(f.size / 1024)) })} onPress={() => website('?tab=minutes')} />
            ))}
          </Card>
        </>
      ) : null}
      <Section title={t('details.websiteTitle')} />
      <Caption>{t('details.websiteBody')}</Caption>
      <Button label={t('details.openWebsite')} icon="arrowUpRight" variant="secondary" size="sm" onPress={() => website()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  multiline: { minHeight: 120 },
  link: { ...type.body, color: colors.flame, textDecorationLine: 'underline' },
});
