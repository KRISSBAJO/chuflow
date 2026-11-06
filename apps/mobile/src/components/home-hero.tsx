import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { colors, fonts, radius, space } from '@/constants/theme';
import { Icon } from './icon';
import { tap } from './ui';

/* Same congregation photography as the website's hero; one per day so Home feels alive. */
const PHOTOS = [
  '1658356788072-ecd83ab24e33',
  '1791357775814-24088f555824',
  '1647957902647-0337913440fc',
  '1614317354806-860a3bf79069',
  '1560251445-ba979d304eb9',
];

function photoOfTheDay(date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return `https://images.unsplash.com/photo-${PHOTOS[day % PHOTOS.length]}?auto=format&fit=crop&w=900&q=70`;
}

/** One number under the greeting; `value` arrives already formatted in the app's language. */
export type HeroMetric = { key: string; label: string; value: string; onPress?: () => void };

type Props = {
  date: Date;
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

export function HomeHero({ date, dateLabel, greeting, name, scope, alerts, alertsLabel, onAlerts, metrics }: Props) {
  return (
    <View style={styles.hero}>
      <Image source={{ uri: photoOfTheDay(date) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} cachePolicy="memory-disk" />
      <LinearGradient
        colors={['rgba(12,12,12,0.25)', 'rgba(12,12,12,0.35)', 'rgba(12,12,12,0.88)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        <Text style={styles.date} numberOfLines={1}>
          {dateLabel}
        </Text>
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
          <Text style={styles.name} numberOfLines={1}>
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
              style={({ pressed }) => [styles.metric, index === 0 ? { paddingLeft: 0 } : styles.metricDivider, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                {metric.value}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
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
    height: 300,
    borderRadius: radius.lg + 4,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  date: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  bell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
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
  bottom: { gap: 2 },
  greeting: { fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.82)' },
  name: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 35, letterSpacing: -0.9, color: '#ffffff' },
  swoosh: { marginTop: 1, marginBottom: 6 },
  scope: { fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  metrics: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  metric: { flex: 1, paddingHorizontal: space.sm },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.22)' },
  metricValue: { fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.4, color: '#ffffff', fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
});
