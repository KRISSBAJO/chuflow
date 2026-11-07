import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { Icon, type IconName } from './icon';
import { Avatar, tap } from './ui';
import { Wordmark } from './wordmark';

const HERO_PHOTO = require('@/assets/images/home-welcome.webp');
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
};
const ICONS: Record<string, IconName> = { guests: 'guests', attendance: 'attendance', members: 'members', followUp: 'care' };
/** A quiet welcome, a locally bundled portrait and readable, actionable summary cards. */
export function HomeHero({ dateLabel, greeting, name, scope, alerts, alertsLabel, onAlerts, metrics, person, onProfile, primaryLabel, onPrimary }: Props) {
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
      <View style={styles.helloRow}>
        <Text style={styles.hello}>
          {greeting}, {name}.
        </Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>
      <View style={styles.welcome}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.headline}>
            {t('people')}
          </Text>
          <Text style={styles.connected}>{t('connected')}</Text>
          <Text style={styles.scope}>{scope}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              onPrimary();
            }}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
            <Icon name="arrowUpRight" size={17} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.photoFrame}>
          <Image source={HERO_PHOTO} style={styles.photo} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" accessible={false} />
        </View>
      </View>
      <View style={styles.metrics}>
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
            style={({ pressed }) => [styles.metric, index === 0 && styles.featured, index === 3 && styles.soft, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.metricTop}>
              <Text style={[styles.metricLabel, index === 0 && styles.onOrange]}>{metric.label}</Text>
              <Icon name={ICONS[metric.key] ?? 'reports'} size={18} color={index === 0 ? '#ffffff' : colors.muted} />
            </View>
            <View style={styles.metricBottom}>
              <Text style={[styles.metricValue, index === 0 && styles.onOrange]} numberOfLines={1} adjustsFontSizeToFit>
                {metric.value}
              </Text>
              {metric.onPress ? <Icon name="arrowUpRight" size={17} color={index === 0 ? '#ffffff' : colors.muted} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.hairline },
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
  helloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hello: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, flex: 1 },
  date: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, maxWidth: '42%', textAlign: 'right' },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  copy: { flex: 1, gap: 3 },
  headline: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 35, letterSpacing: -1, color: colors.ink },
  connected: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 33, lineHeight: 39, letterSpacing: -0.8, color: colors.flame },
  scope: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8 },
  photoFrame: {
    width: '32%',
    height: 170,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e8d4c3',
  },
  photo: { width: '100%', height: '100%', borderTopLeftRadius: 66, borderTopRightRadius: 66, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  primary: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.flame,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 12,
  },
  primaryText: { fontFamily: fonts.medium, fontSize: 12, color: '#fff', flexShrink: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48.4%', minHeight: 103, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.hairlineStrong, justifyContent: 'space-between', gap: 12 },
  featured: { backgroundColor: colors.flame, borderColor: colors.flame },
  soft: { backgroundColor: colors.flameSoft, borderColor: colors.flameSoft },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  metricLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.text, flex: 1 },
  metricBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  metricValue: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 31, color: colors.ink, flexShrink: 1, fontVariant: ['tabular-nums'] },
  onOrange: { color: '#ffffff' },
});
