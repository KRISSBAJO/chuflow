import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { Icon } from './icon';
import { Avatar, tap } from './ui';
import { Wordmark } from './wordmark';

const CHURCH_PHOTO = require('@/assets/images/home-welcome.webp');
export type HeroMetric = { key: string; label: string; value: string; onPress?: () => void };
type Props = {
  dateLabel: string;
  greeting: string;
  name: string;
  scope: string;
  alerts: number;
  alertsLabel: string;
  onAlerts: () => void;
  metrics: HeroMetric[];
  person?: { firstName?: string; lastName?: string };
  onProfile: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  focusLabel: string;
  focusTitle: string;
  focusDetail: string;
  focusKind: 'care' | 'meeting' | 'welcome';
};

export function HomeHero({
  dateLabel,
  greeting,
  name,
  scope,
  alerts,
  alertsLabel,
  onAlerts,
  metrics,
  person,
  onProfile,
  primaryLabel,
  onPrimary,
  focusLabel,
  focusTitle,
  focusDetail,
  focusKind,
}: Props) {
  const t = useT('home.welcome');
  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Wordmark size={24} />
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={alertsLabel}
            onPress={() => {
              tap();
              onAlerts();
            }}
            style={styles.bell}
          >
            <Icon name="bell" size={21} />
            {alerts > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{alerts > 9 ? '9+' : alerts}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('profile')} onPress={onProfile}>
            <Avatar person={person} size={42} />
          </Pressable>
        </View>
      </View>

      <View style={styles.intro}>
        <View style={styles.welcome}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={16} color={colors.muted} />
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </View>
        <Image source={CHURCH_PHOTO} style={styles.photo} contentFit="cover" contentPosition="right" cachePolicy="memory-disk" accessible={false} />
      </View>
      {scope ? <Text style={styles.scope}>{scope}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
        {metrics.map((metric) => (
          <Pressable
            key={metric.key}
            accessibilityRole={metric.onPress ? 'button' : undefined}
            accessibilityLabel={`${metric.label}, ${metric.value}`}
            disabled={!metric.onPress}
            onPress={() => {
              tap();
              metric.onPress?.();
            }}
            style={({ pressed }) => [styles.metric, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.metricValue, metric.key === 'followUp' && { color: '#ac400e' }]}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityHint={primaryLabel}
        onPress={() => {
          tap();
          onPrimary();
        }}
        style={({ pressed }) => [styles.focus, pressed && { transform: [{ scale: 0.985 }], opacity: 0.82 }]}
      >
        <View style={styles.focusIcon}>
          <Icon name={focusKind === 'care' ? 'care' : focusKind === 'meeting' ? 'calendar' : 'guests'} size={24} color="#a6380c" />
        </View>
        <View style={styles.focusCopy}>
          <Text style={styles.kicker}>{focusLabel}</Text>
          <Text style={styles.focusTitle}>{focusKind === 'welcome' ? primaryLabel : focusTitle}</Text>
          {focusKind !== 'welcome' ? <Text style={styles.detail}>{focusDetail}</Text> : null}
        </View>
        <View style={styles.forward}>
          <Icon name="arrowRight" size={19} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.page,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 9, color: '#fff' },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 4 },
  welcome: { flex: 1, minWidth: 0, gap: 4 },
  photo: { width: '34%', maxWidth: 152, height: 148, borderRadius: 22, backgroundColor: colors.surface },
  greeting: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 27, color: colors.text },
  name: { fontFamily: fonts.semibold, fontSize: 35, lineHeight: 42, letterSpacing: -0.9, color: colors.ink },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  date: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, flexShrink: 1 },
  scope: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  focus: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 15, paddingHorizontal: 13, borderRadius: 23, backgroundColor: colors.surface },
  focusIcon: { width: 45, height: 45, borderRadius: 16, backgroundColor: colors.flameSoft, alignItems: 'center', justifyContent: 'center' },
  focusCopy: { flex: 1, minWidth: 0, gap: 3 },
  kicker: { fontFamily: fonts.medium, fontSize: 11, color: '#963b14' },
  focusTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },
  forward: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexGrow: 1, gap: 5, paddingVertical: 6 },
  metric: { flex: 1, minWidth: 83, paddingHorizontal: 7, paddingVertical: 7, gap: 2 },
  metricValue: { fontFamily: fonts.semibold, fontSize: 25, lineHeight: 30, color: colors.ink, fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
});
