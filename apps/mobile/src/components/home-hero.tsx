import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '@/constants/theme';
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
};
/** ChuFlow's daily brief: a personal greeting, a useful next step and one continuous summary strip. */
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
}: Props) {
  const t = useT('home.welcome');
  return (
    <View style={{ gap: space.lg }}>
      <View style={styles.header}>
        <Wordmark size={25} />
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
            <Icon name="bell" size={20} />
            {alerts > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{alerts > 9 ? '9+' : alerts}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('profile')} onPress={onProfile}>
            <Avatar person={person} size={38} />
          </Pressable>
        </View>
      </View>
      <View style={styles.welcome}>
        <View style={styles.marker} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          <Text style={styles.scope}>{scope}</Text>
        </View>
      </View>
      <View style={styles.brief}>
        <View style={styles.briefHeader}>
          <View style={styles.eyebrow}>
            <Icon name="calendar" size={14} color={colors.flame} />
            <Text style={styles.kicker}>{focusLabel}</Text>
          </View>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
        <View style={styles.briefBody}>
          <View style={styles.briefCopy}>
            <Text style={styles.briefTitle}>{focusTitle}</Text>
            <Text style={styles.detail}>{focusDetail}</Text>
          </View>
          <Image source={CHURCH_PHOTO} style={styles.photo} contentFit="cover" contentPosition="bottom" cachePolicy="memory-disk" accessible={false} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            onPrimary();
          }}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
          <Icon name="arrowRight" size={18} color={colors.flame} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metrics}>
        {metrics.map((metric, index) => (
          <Pressable
            key={metric.key}
            accessibilityRole={metric.onPress ? 'button' : undefined}
            accessibilityLabel={`${metric.label}, ${metric.value}`}
            disabled={!metric.onPress}
            onPress={() => {
              tap();
              metric.onPress?.();
            }}
            style={({ pressed }) => [styles.metric, index > 0 && styles.separator, pressed && { opacity: 0.65 }]}
          >
            <Text style={[styles.metricValue, metric.key === 'followUp' && { color: colors.flame }]}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -1,
    top: -2,
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
  welcome: { flexDirection: 'row', gap: 12, alignItems: 'stretch', paddingVertical: 3 },
  marker: { width: 3, borderRadius: 2, backgroundColor: colors.flame, marginVertical: 4 },
  greeting: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  name: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.7, color: colors.ink },
  scope: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  brief: { borderRadius: 20, backgroundColor: '#fff7f0', padding: 16, gap: 15, borderWidth: 1, borderColor: '#f4e6da' },
  briefHeader: { gap: 5 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, color: '#a63f0c', flexShrink: 1 },
  date: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginLeft: 20 },
  briefBody: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  briefCopy: { flex: 1, gap: 7 },
  briefTitle: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, color: colors.ink, letterSpacing: -0.3 },
  detail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.text },
  photo: { width: 83, height: 86, borderRadius: 12, backgroundColor: colors.surfaceStrong },
  primary: { borderTopWidth: 1, borderTopColor: '#eddccc', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 13, color: '#a63f0c', flexShrink: 1 },
  metrics: { flexGrow: 1, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairlineStrong },
  metric: { flex: 1, minWidth: 83, paddingHorizontal: 10, gap: 4, justifyContent: 'center' },
  separator: { borderLeftWidth: 1, borderLeftColor: colors.hairlineStrong },
  metricValue: { fontFamily: fonts.semibold, fontSize: 23, lineHeight: 28, color: colors.ink, fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
});
