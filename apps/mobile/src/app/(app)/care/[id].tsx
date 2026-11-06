import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { type IconName } from '@/components/icon';
import { toast } from '@/components/toast';
import { Avatar, Button, Caption, Chip, ErrorState, Field, Loading, RoundAction, Screen, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { dialable } from '@/lib/format';
import type { FollowUpItem } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const OUTCOMES = ['contacted', 'prayed_with', 'invited_back', 'returned', 'converted'] as const;

const METHODS: { value: string; icon: IconName }[] = [
  { value: 'phone_call', icon: 'phone' },
  { value: 'whatsapp', icon: 'whatsapp' },
  { value: 'text_message', icon: 'message' },
  { value: 'in_person', icon: 'user' },
  { value: 'email', icon: 'mail' },
];

const NEXT: { key: 'none' | 'tomorrow' | 'threeDays' | 'nextWeek'; days: number | null }[] = [
  { key: 'none', days: null },
  { key: 'tomorrow', days: 1 },
  { key: 'threeDays', days: 3 },
  { key: 'nextWeek', days: 7 },
];

export default function LogFollowUpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT('followUp.log');
  const common = useT('common');
  const format = useAppFormat();
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
        <Stack.Screen options={{ title: t('title') }} />
        <ErrorState message={followUp.error ?? common('state.notFound')} onRetry={() => void followUp.refresh()} />
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
      toast.error(t('chooseOutcome'));
      return;
    }
    setSaving(true);
    try {
      const nextActionDate = next ? new Date(Date.now() + next * 86_400_000).toISOString() : undefined;
      await api.patch(`/follow-ups/${item._id}`, {
        status: outcome,
        contactMethod: method,
        note: note.trim() || t('autoNote', { outcome: t(`outcomes.${outcome}.label`), method: t(`methods.${method}`).toLocaleLowerCase() }),
        ...(nextActionDate ? { nextActionDate } : {}),
      });
      void refreshAlerts();
      toast.success(t('saved', { name: guest?.firstName || t('thisGuest') }));
      router.back();
    } catch (error) {
      toast.error(errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <Screen safeTop={false} footer={<Button label={t('submit')} size="lg" loading={saving} disabled={!outcome} onPress={() => void save()} />} contentStyle={{ gap: space.xl }}>
      <Stack.Screen options={{ title: t('title') }} />
      <View style={styles.person}>
        <Avatar person={guest} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.title} numberOfLines={1}>
            {format.fullName(guest)}
          </Text>
          <Caption numberOfLines={1}>{[guest?.phone, format.status(item.status)].filter(Boolean).join(' · ')}</Caption>
        </View>
        {phone ? (
          <View style={styles.reach}>
            <RoundAction icon="phone" label={common('actions.call')} onPress={() => reach('phone_call', `tel:${phone}`)} />
            <RoundAction icon="whatsapp" label={common('actions.whatsapp')} onPress={() => reach('whatsapp', `https://wa.me/${phone.replace('+', '')}`)} />
            <RoundAction icon="message" label={common('actions.text')} onPress={() => reach('text_message', `sms:${phone}`)} />
          </View>
        ) : null}
      </View>

      <View>
        <Section title={t('howDidItGo')} />
        {OUTCOMES.map((value, index) => {
          const selected = outcome === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                tap();
                setOutcome(value);
              }}
              style={[styles.option, index > 0 && styles.divider]}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={type.label}>{t(`outcomes.${value}.label`)}</Text>
                <Caption>{t(`outcomes.${value}.hint`)}</Caption>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.group}>
        <Section title={t('howReached')} />
        <View style={styles.chips}>
          {METHODS.map((option) => (
            <Chip key={option.value} label={t(`methods.${option.value}`)} icon={option.icon} selected={method === option.value} onPress={() => setMethod(option.value)} />
          ))}
        </View>
      </View>

      <Field label={t('note')} value={note} onChangeText={setNote} placeholder={t('notePlaceholder')} multiline />

      <View style={styles.group}>
        <Section title={t('remindMe')} />
        <View style={styles.chips}>
          {NEXT.map((option) => (
            <Chip key={option.key} label={t(`reminders.${option.key}`)} selected={next === option.days} onPress={() => setNext(option.days)} />
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
