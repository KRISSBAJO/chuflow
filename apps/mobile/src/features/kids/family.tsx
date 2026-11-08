import { KidsExtraFields } from './extra-fields';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { StatGrid, StatTile, Timeline, type TimelineItem } from '@/components/kit';
import { Badge, Button, Caption, Card, Chip, EmptyState, ErrorState, Heading, Loading, RoundAction, Screen, Section } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { workspaceBrowserHref } from '@/lib/api';
import { dialable } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { ageInMonths, familyInitials } from './age';
import { ageLabel, InitialAvatar, KIDS, Kicker } from './shared';
import type { Family, RecordEvent } from './types';

/** Family record: guardians, children with ages and care notes, pickup permissions and activity. */
export function FamilyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('kids.family');
  const tf = useT('members.form');
  const ta = useT('kids.age');
  const tt = useT('kids.desk.supervisor.timeline');
  const tc = useT('common.actions');
  const format = useAppFormat();
  const family = useApi<Family>(`/children/families/${id}`);
  const f = family.data;

  if (!f) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        {family.loading ? <Loading /> : <ErrorState message={family.error ?? ''} onRetry={() => void family.refresh()} />}
      </Screen>
    );
  }

  const pickupAdults = new Set(f.children.flatMap((c) => c.pickupGuardianIds));
  const website = (path: string) => void WebBrowser.openBrowserAsync(workspaceBrowserHref(path));
  const events: TimelineItem[] = [...(f.events ?? []), ...f.children.flatMap((c) => (c.events ?? []).map((e) => ({ ...e, note: e.note || `${c.firstName} ${c.lastName}` })))]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10)
    .map((e: RecordEvent, i) => ({
      key: `${e.at}-${i}`,
      title: tt.has(`actions.${e.action}`) ? tt(`actions.${e.action}`) : e.action.replace(/_/g, ' '),
      subtitle: [e.note, e.actorName].filter(Boolean).join(' · '),
      at: format.shortDate(e.at),
    }));

  return (
    <Screen safeTop={false} refreshing={family.refreshing} onRefresh={() => void family.refresh()}>
      <Stack.Screen options={{ title: f.name }} />
      <View style={styles.head}>
        <InitialAvatar text={familyInitials(f.name)} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Kicker>{t('title')}</Kicker>
          <Heading numberOfLines={2}>{f.name}</Heading>
        </View>
      </View>

      <StatGrid>
        <StatTile label={t('statAdults')} value={f.guardians.length} tone="success" />
        <StatTile label={t('statChildren')} value={f.children.length} tone="warning" />
        <StatTile label={t('statPickup')} value={pickupAdults.size} hint={t('statPickupHint')} tone="info" />
        <StatTile label={t('statMembers')} value={f.children.filter((c) => c.isMember).length} />
      </StatGrid>

      <View style={styles.actions}>
        <Button label={t('printCard')} icon="print" variant="secondary" size="sm" onPress={() => website(`/children/families/${id}`)} />
        <Button label={t('edit')} icon="edit" variant="ghost" size="sm" onPress={() => website(`/children/families/${id}/edit`)} />
      </View>
      <Caption>{t('printHint')}</Caption>

      {f.customAnswers?.length ? <View><Section title={tf('extraAnswers')} />{f.customAnswers.map(({ key, label, value }) => <Caption key={key}>{label} · {String(value)}</Caption>)}</View> : null}
      <KidsExtraFields family={f} onSaved={() => void family.reload()} />
      <Section title={t('adults')} />
      {f.guardians.length ? (
        f.guardians.map((g, i) => (
          <View key={g.id} style={[styles.guardian, i > 0 && styles.divider]}>
            <InitialAvatar text={familyInitials(`${g.firstName} ${g.lastName}`)} tone="plain" />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={type.label}>
                {g.firstName} {g.lastName}
              </Text>
              <Caption numberOfLines={1}>{[g.phone, g.email].filter(Boolean).join(' · ')}</Caption>
              <View style={styles.badges}>
                <Badge label={g.relationship} />
                <Badge label={g.canCheckIn ? t('mayCheckIn') : t('contactOnly')} tone={g.canCheckIn ? 'success' : 'warning'} />
                {pickupAdults.has(g.id) ? <Badge label={t('statPickup')} tone="info" /> : null}
                {g.memberId ? <Badge label={t('memberLinked')} tone="flame" /> : null}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              {g.phone ? <RoundAction icon="phone" label={tc('call')} onPress={() => void Linking.openURL(`tel:${dialable(g.phone)}`)} /> : null}
              {g.phone ? <RoundAction icon="message" label={tc('text')} onPress={() => void Linking.openURL(`sms:${dialable(g.phone)}`)} /> : null}
              {g.email ? <RoundAction icon="mail" label={tc('email')} onPress={() => void Linking.openURL(`mailto:${g.email}`)} /> : null}
            </View>
          </View>
        ))
      ) : (
        <EmptyState icon="user" title={t('noAdults')} />
      )}

      <Section title={t('children')} />
      {f.children.length ? (
        f.children.map((c) => {
          const pickup = f.guardians.filter((g) => c.pickupGuardianIds.includes(g.id));
          const months = ageInMonths(c.birthDate);
          return (
            <Card key={c._id} style={{ gap: space.sm }}>
              <View style={styles.head}>
                <InitialAvatar text={familyInitials(`${c.firstName} ${c.lastName}`)} tone="amber" size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={type.label}>
                    {c.firstName} {c.lastName}
                  </Text>
                  <Caption>
                    {ageLabel(ta, months)} · {t('born', { date: format.date(c.birthDate) })}
                  </Caption>
                </View>
              </View>
              <View style={styles.badges}>
                <Badge label={c.isMember ? t('childMember') : t('visitor')} tone={c.isMember ? 'success' : 'info'} />
                <Badge label={c.isActive ? t('active') : t('inactive')} tone={c.isActive ? 'neutral' : 'danger'} />
                {c.careNotes ? <Badge label={t('careAlert')} tone="danger" /> : null}
                {c.photoConsent ? <Badge label={t('photoOk')} tone="flame" /> : null}
              </View>
              <View style={{ gap: 6 }}>
                <Caption>{t('pickup')}</Caption>
                <View style={styles.badges}>
                  {pickup.length ? pickup.map((g) => <Chip key={g.id} label={`${g.firstName} ${g.lastName} · ${g.relationship}`} selected onPress={() => undefined} />) : <Badge label={t('noPickup')} tone="danger" />}
                </View>
              </View>
              {c.careNotes ? (
                <View style={[styles.note, { backgroundColor: colors.dangerBg }]}>
                  <Text style={[type.micro, { color: colors.danger, textTransform: 'uppercase' }]}>{t('careNotes')}</Text>
                  <Text style={type.body}>{c.careNotes}</Text>
                </View>
              ) : null}
              {c.pickupNotes ? (
                <View style={[styles.note, { backgroundColor: KIDS.amberSoft }]}>
                  <Text style={[type.micro, { color: KIDS.amberInk, textTransform: 'uppercase' }]}>{t('pickupNotes')}</Text>
                  <Text style={type.body}>{c.pickupNotes}</Text>
                </View>
              ) : null}
              {c.customAnswers?.map(({ key, label, value }) => <Caption key={key}>{label} · {String(value)}</Caption>)}
              <KidsExtraFields family={f} child={c} onSaved={() => void family.reload()} />
            </Card>
          );
        })
      ) : (
        <EmptyState icon="smile" title={t('noChildren')} body={t('noChildrenHint')} />
      )}

      <Section title={t('activity')} />
      {events.length ? <Timeline items={events} /> : <Caption>{t('noActivity')}</Caption>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  guardian: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { borderRadius: radius.md, padding: space.md, gap: 4 },
});
