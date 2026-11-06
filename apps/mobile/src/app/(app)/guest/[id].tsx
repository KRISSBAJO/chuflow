import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Caption, ErrorState, Loading, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { branchName, dialable, statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { FollowUpListResponse, GuestDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Lives in the members area; cast until the typed routes file is regenerated. */
const convertHref = (guestId: string) => ({ pathname: '/members/convert', params: { guestId } }) as unknown as Href;

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

function Detail({ label, value, onLongPress, first }: { label: string; value?: string | null; onLongPress?: () => void; first?: boolean }) {
  if (!value) return null;
  return (
    <Pressable onLongPress={onLongPress} disabled={!onLongPress} style={[styles.detail, !first && styles.divider]}>
      <Caption>{label}</Caption>
      <Text style={[type.body, { color: colors.ink, marginTop: 1 }]}>{value}</Text>
    </Pressable>
  );
}

export default function GuestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const t = useT('guests.profile');
  const common = useT('common');
  const format = useAppFormat();
  const guest = useApi<GuestDetail>(`/guests/${id}`);
  const followUps = useApi<FollowUpListResponse>(can.followUp(user?.role) ? `/follow-ups?guestId=${id}&limit=5` : null);

  if (guest.loading) return <Loading />;
  if (guest.error || !guest.data) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState message={guest.error ?? t('notFound')} onRetry={() => void guest.refresh()} />
      </Screen>
    );
  }

  const person = guest.data;
  const phone = dialable(person.phone);
  const care = followUps.data?.items[0];
  const canConvert = can.convertGuests(user?.role) && !person.convertedToMember;
  const details = [
    { key: 'phone', label: t('phoneHold'), value: person.phone, copy: true },
    { key: 'email', label: t('email'), value: person.email },
    { key: 'invitedBy', label: t('invitedBy'), value: person.invitedBy },
    { key: 'heardAbout', label: t('heardAbout'), value: person.heardAboutChurch },
    { key: 'address', label: t('address'), value: [person.address, person.city, person.state].filter(Boolean).join(', ') },
    { key: 'prayerRequest', label: t('prayerRequest'), value: person.prayerRequest },
  ].filter((detail) => detail.value);

  return (
    <Screen safeTop={false} refreshing={guest.refreshing} onRefresh={() => void guest.refresh()} contentStyle={{ gap: space.xl }}>
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.hero}>
        <Avatar person={person} size={56} />
        <Text style={[type.display, { fontSize: 21, textAlign: 'center' }]}>{format.fullName(person)}</Text>
        <View style={styles.badges}>
          <Badge label={format.status(person.visitStatus)} tone={statusTone(person.visitStatus)} />
          {person.wantsPastoralCall ? <Badge label={t('wantsCall')} tone="flame" /> : null}
        </View>
        <Caption>{[branchName(person.branchId), person.createdAt ? t('registered', { date: format.date(person.createdAt) }) : null].filter(Boolean).join(' · ')}</Caption>
      </View>

      {phone || person.email ? (
        <View style={styles.quickRow}>
          {phone ? <QuickAction icon="phone" label={common('actions.call')} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          {phone ? <QuickAction icon="whatsapp" label={common('actions.whatsapp')} onPress={() => void Linking.openURL(`https://wa.me/${phone.replace('+', '')}`)} /> : null}
          {phone ? <QuickAction icon="message" label={common('actions.text')} onPress={() => void Linking.openURL(`sms:${phone}`)} /> : null}
          {person.email ? <QuickAction icon="mail" label={common('actions.email')} onPress={() => void Linking.openURL(`mailto:${person.email}`)} /> : null}
        </View>
      ) : null}

      {care ? (
        <View style={styles.care}>
          <View style={styles.careTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.micro, { textTransform: 'uppercase' }]}>{t('followUp')}</Text>
              <Text style={[type.title, { marginTop: 3 }]}>{format.status(care.status)}</Text>
              <Caption>
                {care.assignedTo ? t('with', { name: format.fullName(care.assignedTo) }) : t('notAssigned')} · {format.relativeTime(care.updatedAt)}
              </Caption>
            </View>
            <Button label={t('log')} icon="check" size="sm" onPress={() => router.push(`/care/${care._id}`)} />
          </View>
          {care.note ? (
            <Text style={[type.body, { marginTop: space.sm }]} numberOfLines={3}>
              {care.note}
            </Text>
          ) : null}
        </View>
      ) : null}

      {details.length ? (
        <View>
          <Section title={t('details')} />
          {details.map((detail, index) => (
            <Detail
              key={detail.key}
              first={index === 0}
              label={detail.label}
              value={detail.value}
              onLongPress={
                detail.copy && person.phone ? () => void Clipboard.setStringAsync(person.phone).then(() => toast.success(t('phoneCopied'))) : undefined
              }
            />
          ))}
        </View>
      ) : null}

      {canConvert ? (
        <Button
          label={t('convertToMember')}
          icon="members"
          variant="secondary"
          onPress={() => router.push(convertHref(person._id))}
        />
      ) : null}
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
  care: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
  careTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  detail: { paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
});
