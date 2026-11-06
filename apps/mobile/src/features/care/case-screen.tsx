import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { Banner, KeyValue, Timeline, type TimelineItem } from '@/components/kit';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Caption, Card, ErrorState, Loading, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { dialable } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { CheckInLinkSheet } from './check-in-link-sheet';
import { eventTone, stageTone, useCareLabel } from './labels';
import { careId, careOwner, type CareRecord } from './types';
import { CareUpdateSheet } from './update-sheet';

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

/** One care record: GET /care/cases/:id with its open tasks and activity, plus the update and link sheets. */
export function CareCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('care.case');
  const tl = useT('care.list');
  const tc = useT('common');
  const label = useCareLabel();
  const format = useAppFormat();
  const { user } = useSession();
  const record = useApi<CareRecord>(`/care/cases/${id}`);

  const [sheet, setSheet] = useState<{ kind: 'contact' | 'note' | 'task' | 'stage' | 'owner'; method?: string; taskId?: string } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (record.loading) return <Loading />;
  if (record.error || !record.data) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <ErrorState message={record.error ?? t('notFound')} onRetry={() => void record.refresh()} />
      </Screen>
    );
  }

  const c = record.data;
  const phone = dialable(c.phone);
  const owner = careOwner(c.ownerId) ?? c.people.find((person) => person._id === careId(c.ownerId)) ?? null;
  const backup = c.people.find((person) => person._id === c.backupId) ?? null;
  const openTasks = c.tasks.filter((task) => task.status === 'open');
  const branch = typeof c.branchId === 'object' ? c.branchId.name : '';
  const canLink = c.canManage && can.lead(user?.role);

  async function change(operation: 'accept' | 'decline' | 'enroll') {
    setBusy(true);
    try {
      const next = await api.patch<CareRecord>(`/care/cases/${c._id}`, { expectedRevision: c.revision, operation });
      record.setData(() => next);
      toast.success(t('saved'));
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function reach(method: string, url: string) {
    void Linking.openURL(url);
    if (c.canManage) setSheet({ kind: 'contact', method });
  }

  const when = (value?: string) => (value ? format.dateTime(value) : t('notRecorded'));
  const details = [
    { label: t('careOwner'), value: owner ? `${owner.firstName} ${owner.lastName}` : tl('unassigned') },
    { label: t('backup'), value: backup ? `${backup.firstName} ${backup.lastName}` : '' },
    { label: t('lastContact'), value: when(c.lastContactAt) },
    { label: t('lastAttendance'), value: when(c.lastAttendanceAt) },
    { label: t('branch'), value: branch },
    { label: t('recordType'), value: label(c.personType) },
    { label: t('language'), value: t.has(`languages.${c.language}`) ? t(`languages.${c.language}`) : c.language },
    { label: t('emailAllowed'), value: c.emailAllowed ? tc('actions.yes') : tc('actions.no') },
    ...(c.handover ? [{ label: label('handover'), value: label(c.handover.status) }] : []),
  ];

  const events: TimelineItem[] = c.events.map((event) => {
    const method = event.data?.method ? label(event.data.method) : '';
    const outcome = event.data?.outcome ? label(event.data.outcome) : event.data?.stage ? label(event.data.stage) : '';
    const actor = event.actorId ? `${event.actorId.firstName} ${event.actorId.lastName}` : '';
    const title = [label(event.kind), outcome, method].filter(Boolean).join(' · ');
    const subtitleParts = [event.text, actor, event.visibility === 'pastoral' ? t('leadershipOnly') : '', event.data?.nextActionAt ? t('dueOn', { date: format.shortDate(event.data.nextActionAt) }) : ''].filter(Boolean);
    return { key: event._id, title, subtitle: subtitleParts.join(' — '), at: format.relativeTime(event.createdAt), tone: eventTone(event.kind, event.data?.outcome) };
  });

  return (
    <Screen safeTop={false} refreshing={record.refreshing} onRefresh={() => void record.refresh()} contentStyle={{ gap: space.xl }}>
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.hero}>
        <Avatar person={c} size={56} />
        <Text style={type.micro}>{label(c.journey).toUpperCase()}</Text>
        <Text style={[type.display, { fontSize: 21, textAlign: 'center' }]}>
          {c.firstName} {c.lastName}
        </Text>
        <View style={styles.badges}>
          <Badge label={c.stopContact ? t('contactStopped') : label(c.stage)} tone={stageTone(c.stage, c.stopContact)} />
          {c.stage === 'paused' && c.pausedUntil ? <Badge label={t('pausedUntil', { date: format.shortDate(c.pausedUntil) })} tone="neutral" /> : null}
        </View>
        <Caption>{[c.email || t('noEmail'), c.phone].filter(Boolean).join(' · ')}</Caption>
      </View>

      {phone || c.email ? (
        <View style={styles.quickRow}>
          {phone ? <QuickAction icon="phone" label={tc('actions.call')} onPress={() => reach('phone', `tel:${phone}`)} /> : null}
          {phone ? <QuickAction icon="whatsapp" label={tc('actions.whatsapp')} onPress={() => reach('whatsapp', `https://wa.me/${phone.replace('+', '')}`)} /> : null}
          {phone ? <QuickAction icon="message" label={tc('actions.text')} onPress={() => reach('text', `sms:${phone}`)} /> : null}
          {c.email ? <QuickAction icon="mail" label={tc('actions.email')} onPress={() => reach('email', `mailto:${c.email}`)} /> : null}
        </View>
      ) : null}

      {c.canAccept ? (
        <Banner
          tone="flame"
          icon="care"
          title={t('handoverWaiting')}
          body={t('handoverPrevious')}
          action={
            <View style={{ gap: 6 }}>
              <Button label={t('accept')} size="sm" variant="flame" loading={busy} onPress={() => void change('accept')} />
              <Button label={t('decline')} size="sm" variant="secondary" disabled={busy} onPress={() => void change('decline')} />
            </View>
          }
        />
      ) : null}

      <View style={styles.actions}>
        {c.canManage ? <Button label={t('logActivity')} icon="edit" size="sm" onPress={() => setSheet({ kind: c.stopContact ? 'note' : 'contact' })} /> : null}
        {canLink ? <Button label={t('checkInLink')} icon="link" variant="secondary" size="sm" onPress={() => setLinkOpen(true)} /> : null}
        {c.guestId && can.guests(user?.role) ? <Button label={t('guestRecord')} icon="guests" variant="secondary" size="sm" onPress={() => router.push(`/guest/${c.guestId}` as Href)} /> : null}
        {c.memberId && can.members(user?.role) ? <Button label={t('memberRecord')} icon="members" variant="secondary" size="sm" onPress={() => router.push(`/members/${c.memberId}` as Href)} /> : null}
        {c.canManage && !c.automationEnrolledAt && !c.stopContact ? <Button label={t('startPlan')} icon="sparkle" variant="secondary" size="sm" loading={busy} onPress={() => void change('enroll')} /> : null}
      </View>

      <View>
        <Section title={t('details')} />
        <KeyValue rows={details} />
      </View>

      <Card>
        <Text style={type.micro}>{t('suggested').toUpperCase()}</Text>
        <Text style={[type.body, { marginTop: 6 }]} selectable>
          {t('suggestedMessage', { name: c.firstName })}
        </Text>
      </Card>

      <View>
        <Section title={t('openTasks')} action={c.canManage ? tc('actions.add') : undefined} onAction={c.canManage ? () => setSheet({ kind: 'task' }) : undefined} />
        {openTasks.length ? (
          openTasks.map((task, index) => (
            <Pressable
              key={task._id}
              disabled={!c.canManage}
              onPress={() => setSheet({ kind: 'contact', taskId: task._id })}
              style={({ pressed }) => [styles.task, index > 0 && styles.divider, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.label}>{task.title}</Text>
                <Caption numberOfLines={2}>
                  {[t('dueOn', { date: format.shortDate(task.dueAt) }), task.escalated ? t('leadershipReview') : '', task.evidence].filter(Boolean).join(' · ')}
                </Caption>
              </View>
              {task.escalated ? <Badge label={label('escalated')} tone="danger" /> : null}
              {c.canManage ? <Icon name="chevronRight" size={15} color={colors.faint} /> : null}
            </Pressable>
          ))
        ) : (
          <Caption>{t('noOpenTasks')}</Caption>
        )}
      </View>

      <View>
        <Section title={t('milestones')} action={c.canManage ? label('journey') : undefined} onAction={c.canManage ? () => setSheet({ kind: 'stage' }) : undefined} />
        {c.milestones.length ? (
          <View style={styles.chips}>
            {c.milestones.map((milestone) => (
              <Badge key={milestone} label={label(milestone)} tone="success" />
            ))}
          </View>
        ) : (
          <Caption>{t('noMilestones')}</Caption>
        )}
      </View>

      {c.isAdmin ? (
        <View style={styles.actions}>
          <Button label={t('careOwner')} icon="user" variant="secondary" size="sm" onPress={() => setSheet({ kind: 'owner' })} />
        </View>
      ) : null}

      <View>
        <Section title={t('timeline')} />
        {events.length ? <Timeline items={events} /> : <Caption>{t('noActivity')}</Caption>}
        {c.eventTotal > c.events.length ? <Notice tone="neutral" icon="info">{t('moreOnWebsite', { count: c.eventTotal - c.events.length })}</Notice> : null}
      </View>

      <Pressable
        onLongPress={c.phone ? () => void Clipboard.setStringAsync(c.phone ?? '').then(() => toast.success(t('copiedPhone'))) : undefined}
        disabled={!c.phone}
      >
        <Caption style={{ textAlign: 'center' }}>{c.phone ? t('holdToCopy') : ' '}</Caption>
      </Pressable>

      <CareUpdateSheet
        record={c}
        visible={!!sheet}
        initialKind={sheet?.kind}
        initialMethod={sheet?.method}
        taskId={sheet?.taskId}
        onClose={() => setSheet(null)}
        onSaved={(next) => record.setData(() => next)}
      />
      <CheckInLinkSheet record={c} visible={linkOpen} onClose={() => setLinkOpen(false)} />
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
  task: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
