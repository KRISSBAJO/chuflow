import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { colors, fonts, space } from '@/constants/theme';
import { Icon } from './icon';
import { tap } from './ui';

/*
 * Home opens on the congregation photo, edge to edge and up under the status bar, with the
 * greeting and the four headline numbers floating on it in frosted tiles. It pulls itself out
 * of the page's gutters and safe-area padding with negative margins, so the page below keeps
 * its usual rhythm.
 */

/* Bundled with the app so Home has its photo before the first request and when offline. */
const HERO_PHOTO = require('@/assets/images/home-welcome.webp');

/** One number under the greeting; `value` arrives already formatted in the app's language. */
export type HeroMetric = { key: string; label: string; value: string; onPress?: () => void };

type Props = {
  /** The date already written out in the app's language. */
  dateLabel: string;
  greeting: string;
  name: string;
  scope: string;
  alerts: number;
  /** Accessibility label for the bell, e.g. "Alerts, 3 active". */
  alertsLabel: string;
  onAlerts: () => void;
  metrics: HeroMetric[];
};

export function HomeHero({ dateLabel, greeting, name, scope, alerts, alertsLabel, onAlerts, metrics }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { marginTop: -(insets.top + space.md), paddingTop: insets.top + space.md, minHeight: 312 + insets.top }]}>
      <Image source={HERO_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="bottom" transition={180} cachePolicy="memory-disk" accessible={false} />
      <LinearGradient colors={['rgba(8,8,8,0.42)', 'rgba(8,8,8,0)']} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(8,8,8,0)', 'rgba(8,8,8,0.5)', 'rgba(8,8,8,0.93)']} locations={[0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <View style={styles.top}>
        <View style={styles.datePill}>
          <Icon name="calendar" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.date} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={alertsLabel}
          hitSlop={8}
          onPress={() => {
            tap();
            onAlerts();
          }}
          style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}
        >
          <Icon name="bell" size={17} color="#ffffff" />
          {alerts ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{alerts > 9 ? '9+' : alerts}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.greeting}>{greeting},</Text>
        <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
            {name}
          </Text>
          <Svg width="100%" height={10} viewBox="0 0 100 16" preserveAspectRatio="none" style={styles.swoosh}>
            <Defs>
              <SvgGradient id="hero-flame" x1="0" x2="1" y1="0" y2="0">
                <Stop offset="0" stopColor={colors.flameFrom} />
                <Stop offset="1" stopColor={colors.flameTo} />
              </SvgGradient>
            </Defs>
            <Path d="M2 10 C 20 3, 36 15, 54 8 S 84 4, 98 7" stroke="url(#hero-flame)" strokeWidth={3.2} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
        <Text style={styles.scope} numberOfLines={1}>
          {scope}
        </Text>

        <View style={styles.metrics}>
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
              style={({ pressed }) => [styles.metric, pressed && { backgroundColor: 'rgba(255,255,255,0.28)' }]}
            >
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                {metric.value}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {metric.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -space.page,
    paddingHorizontal: space.page,
    paddingBottom: space.md,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '75%',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  date: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)', flexShrink: 1 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontFamily: fonts.semibold, fontSize: 9, color: '#ffffff' },
  bottom: { gap: 1, marginTop: space.lg },
  greeting: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  name: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, color: '#ffffff' },
  swoosh: { marginTop: 0, marginBottom: 4 },
  scope: { fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.72)' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: space.md },
  metric: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  metricValue: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 23, letterSpacing: -0.5, color: '#ffffff', fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: fonts.regular, fontSize: 11, letterSpacing: 0, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
});
