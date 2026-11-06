import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Caption, ErrorState, Loading, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { branchName, dialable, fullName, relativeTime, shortDate, statusLabel, statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { FollowUpListResponse, GuestDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

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
  const guest = useApi<GuestDetail>(`/guests/${id}`);
  const followUps = useApi<FollowUpListResponse>(can.followUp(user?.role) ? `/follow-ups?guestId=${id}&limit=5` : null);

  if (guest.loading) return <Loading />;
  if (guest.error || !guest.data) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={guest.error ?? 'Guest not found'} onRetry={() => void guest.refresh()} />
      </Screen>
    );
  }

  const person = guest.data;
  const phone = dialable(person.phone);
  const care = followUps.data?.items[0];
  const details = [
    { label: 'Phone · hold to copy', value: person.phone, copy: true },
    { label: 'Email', value: person.email },
    { label: 'Invited by', value: person.invitedBy },
    { label: 'Heard about us', value: person.heardAboutChurch },
    { label: 'Address', value: [person.address, person.city, person.state].filter(Boolean).join(', ') },
    { label: 'Prayer request', value: person.prayerRequest },
  ].filter((detail) => detail.value);

  return (
    <Screen safeTop={false} refreshing={guest.refreshing} onRefresh={() => void guest.refresh()} contentStyle={{ gap: space.xl }}>
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.hero}>
        <Avatar person={person} size={56} />
        <Text style={[type.display, { fontSize: 21, textAlign: 'center' }]}>{fullName(person)}</Text>
        <View style={styles.badges}>
          <Badge label={statusLabel(person.visitStatus)} tone={statusTone(person.visitStatus)} />
          {person.wantsPastoralCall ? <Badge label="Wants a pastor's call" tone="flame" /> : null}
        </View>
        <Caption>
          {[branchName(person.branchId), person.createdAt ? `Registered ${shortDate(person.createdAt).toLowerCase()}` : null].filter(Boolean).join(' · ')}
        </Caption>
      </View>

      {phone || person.email ? (
        <View style={styles.quickRow}>
          {phone ? <QuickAction icon="phone" label="Call" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
          {phone ? <QuickAction icon="whatsapp" label="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${phone.replace('+', '')}`)} /> : null}
          {phone ? <QuickAction icon="message" label="Text" onPress={() => void Linking.openURL(`sms:${phone}`)} /> : null}
          {person.email ? <QuickAction icon="mail" label="Email" onPress={() => void Linking.openURL(`mailto:${person.email}`)} /> : null}
        </View>
      ) : null}

      {care ? (
        <View style={styles.care}>
          <View style={styles.careTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type.micro}>FOLLOW-UP</Text>
              <Text style={[type.title, { marginTop: 3 }]}>{statusLabel(care.status)}</Text>
              <Caption>
                {care.assignedTo ? `With ${fullName(care.assignedTo)}` : 'Not assigned yet'} · {relativeTime(care.updatedAt)}
              </Caption>
            </View>
            <Button label="Log" icon="check" size="sm" onPress={() => router.push(`/care/${care._id}`)} />
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
          <Section title="Details" />
          {details.map((detail, index) => (
            <Detail
              key={detail.label}
              first={index === 0}
              label={detail.label}
              value={detail.value}
              onLongPress={
                detail.copy && person.phone ? () => void Clipboard.setStringAsync(person.phone).then(() => toast.success('Phone number copied')) : undefined
              }
            />
          ))}
        </View>
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
