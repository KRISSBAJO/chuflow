import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

      <View style={styles.cover}>
        <Image source={CHURCH_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" cachePolicy="memory-disk" accessible={false} />
        <LinearGradient colors={['rgba(23,14,10,0.28)', 'transparent', 'rgba(23,14,10,0.90)']} locations={[0, 0.32, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.datePill}>
          <Icon name="calendar" size={14} color="#ffffff" />
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <View style={styles.welcome}>
          <View style={styles.spark} />
          <Text style={styles.greeting}>{greeting},</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          {scope ? <Text style={styles.scope}>{scope}</Text> : null}
        </View>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
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
  cover: { minHeight: 266, borderRadius: 28, padding: 20, gap: 34, overflow: 'hidden', justifyContent: 'space-between', backgroundColor: '#3c2820' },
  datePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(27,16,12,0.65)',
  },
  date: { fontFamily: fonts.medium, fontSize: 12, color: '#ffffff', flexShrink: 1 },
  welcome: { gap: 4 },
  spark: { width: 24, height: 4, borderRadius: 2, backgroundColor: '#ff9c59', marginBottom: 5 },
  greeting: { fontFamily: fonts.medium, fontSize: 15, color: '#fff4e9' },
  name: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 39, letterSpacing: -0.9, color: '#ffffff' },
  scope: { fontFamily: fonts.regular, fontSize: 12, color: '#fff4e9' },
  focus: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 15, paddingHorizontal: 13, borderRadius: 23, backgroundColor: '#f7f3ef' },
  focusIcon: { width: 45, height: 45, borderRadius: 16, backgroundColor: '#ffeadb', alignItems: 'center', justifyContent: 'center' },
  focusCopy: { flex: 1, minWidth: 0, gap: 3 },
  kicker: { fontFamily: fonts.medium, fontSize: 11, color: '#963b14' },
  focusTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  detail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.text },
  forward: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#392219', alignItems: 'center', justifyContent: 'center' },
  metrics: { flexGrow: 1, gap: 5, paddingVertical: 6 },
  metric: { flex: 1, minWidth: 83, paddingHorizontal: 7, paddingVertical: 7, gap: 2 },
  metricValue: { fontFamily: fonts.semibold, fontSize: 25, lineHeight: 30, color: colors.ink, fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
});
