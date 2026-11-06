import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { type IconName } from '@/components/icon';
import { toast } from '@/components/toast';
import { Avatar, Button, Caption, Chip, ErrorState, Field, Loading, RoundAction, Screen, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { dialable, fullName, statusLabel } from '@/lib/format';
import type { FollowUpItem } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const OUTCOMES: { value: string; label: string; hint: string }[] = [
  { value: 'contacted', label: 'Reached them', hint: 'Spoke or left a message' },
  { value: 'prayed_with', label: 'Prayed together', hint: 'Shared a prayer' },
  { value: 'invited_back', label: 'Invited back', hint: 'They plan to come again' },
  { value: 'returned', label: 'Came back', hint: 'Attended another service' },
  { value: 'converted', label: 'Became a member', hint: 'Joined the church' },
];

const METHODS: { value: string; label: string; icon: IconName }[] = [
  { value: 'phone_call', label: 'Call', icon: 'phone' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { value: 'text_message', label: 'Text', icon: 'message' },
  { value: 'in_person', label: 'In person', icon: 'user' },
  { value: 'email', label: 'Email', icon: 'mail' },
];

const NEXT: { label: string; days: number | null }[] = [
  { label: 'No reminder', days: null },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

export default function LogFollowUpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const followUp = useApi<FollowUpItem>(`/follow-ups/${id}`);
  const { refresh: refreshAlerts } = useAlerts();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [method, setMethod] = useState('phone_call');
  const [note, setNote] = useState('');
  const [next, setNext] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (followUp.loading) return <Loading />;
  if (followUp.error || !followUp.data) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={followUp.error ?? 'Not found'} onRetry={() => void followUp.refresh()} />
      </Screen>
    );
  }

  const item = followUp.data;
  const guest = item.guestId;
  const phone = dialable(guest?.phone);

  function reach(methodValue: string, url: string) {
    setMethod(methodValue);
    void Linking.openURL(url);
  }

  async function save() {
    if (!outcome) {
      toast.error('Choose how it went first.');
      return;
    }
    setSaving(true);
    try {
      const nextActionDate = next ? new Date(Date.now() + next * 86_400_000).toISOString() : undefined;
      await api.patch(`/follow-ups/${item._id}`, {
        status: outcome,
        contactMethod: method,
        note:
          note.trim() ||
          `${OUTCOMES.find((option) => option.value === outcome)?.label} by ${METHODS.find((option) => option.value === method)?.label.toLowerCase()}.`,
        ...(nextActionDate ? { nextActionDate } : {}),
      });
      void refreshAlerts();
      toast.success(`Saved for ${guest?.firstName ?? 'this guest'}`);
      router.back();
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Screen safeTop={false} footer={<Button label="Save follow-up" size="lg" loading={saving} disabled={!outcome} onPress={() => void save()} />} contentStyle={{ gap: space.xl }}>
      <View style={styles.person}>
        <Avatar person={guest} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.title} numberOfLines={1}>
            {fullName(guest)}
          </Text>
          <Caption numberOfLines={1}>{[guest?.phone, statusLabel(item.status)].filter(Boolean).join(' · ')}</Caption>
        </View>
        {phone ? (
          <View style={styles.reach}>
            <RoundAction icon="phone" label="Call" onPress={() => reach('phone_call', `tel:${phone}`)} />
            <RoundAction icon="whatsapp" label="WhatsApp" onPress={() => reach('whatsapp', `https://wa.me/${phone.replace('+', '')}`)} />
            <RoundAction icon="message" label="Text" onPress={() => reach('text_message', `sms:${phone}`)} />
          </View>
        ) : null}
      </View>

      <View>
        <Section title="How did it go?" />
        {OUTCOMES.map((option, index) => {
          const selected = outcome === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                tap();
                setOutcome(option.value);
              }}
              style={[styles.option, index > 0 && styles.divider]}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={type.label}>{option.label}</Text>
                <Caption>{option.hint}</Caption>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.group}>
        <Section title="How you reached them" />
        <View style={styles.chips}>
          {METHODS.map((option) => (
            <Chip key={option.value} label={option.label} icon={option.icon} selected={method === option.value} onPress={() => setMethod(option.value)} />
          ))}
        </View>
      </View>

      <Field label="Note" value={note} onChangeText={setNote} placeholder="What did you talk about? Any prayer needs?" multiline />

      <View style={styles.group}>
        <Section title="Remind me" />
        <View style={styles.chips}>
          {NEXT.map((option) => (
            <Chip key={option.label} label={option.label} selected={next === option.days} onPress={() => setNext(option.days)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reach: { flexDirection: 'row', gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#c9c6bf', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ink },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
