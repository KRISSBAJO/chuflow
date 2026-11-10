import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Icon } from '@/components/icon';
import { colors, fonts, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';

const destinations = [
  { key: 'home', icon: 'home' },
  { key: 'events', icon: 'calendar' },
  { key: 'community', icon: 'message' },
  { key: 'journey', icon: 'book' },
  { key: 'serve', icon: 'care' },
] as const;

export type YouthTab = (typeof destinations)[number]['key'];

export function YouthNavigation({ tab, onChange, accent, tint }: {
  tab: YouthTab;
  onChange: (tab: YouthTab) => void;
  accent: string;
  tint: string;
}) {
  const t = useT('youth.participantHome');
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(360);
  const mid = width / 2;
  const top = 'M 0 48 Q 0 24 24 24 H ' + (mid - 69)
    + ' C ' + (mid - 46) + ' 24 ' + (mid - 43) + ' 64 ' + mid + ' 64'
    + ' S ' + (mid + 46) + ' 24 ' + (mid + 69) + ' 24'
    + ' H ' + (width - 24) + ' Q ' + width + ' 24 ' + width + ' 48';
  return <View style={[styles.dock, { paddingBottom: Math.max(8, insets.bottom) }]}>
    <View pointerEvents="none" style={styles.base} />
    <View accessibilityRole="tablist" style={styles.tabs} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Svg pointerEvents="none" accessible={false} width="100%" height={78} style={styles.shape}>
        <Path d={top + ' V 78 H 0 Z'} fill={colors.page} />
        <Path d={top} fill="none" stroke={colors.hairlineStrong} strokeWidth={1} />
      </Svg>
      {destinations.map(({ key, icon }) => {
        const center = key === 'community';
        const selected = tab === key;
        const label = t(key);
        return <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
          onPress={() => onChange(key)} style={({ pressed }) => [styles.tab, center && styles.centerTab, pressed && styles.pressed]}>
          <View style={center
            ? [styles.orb, { backgroundColor: accent, shadowColor: accent }]
            : [styles.icon, selected && { backgroundColor: tint }]}>
            <Icon name={icon} size={center ? 26 : 22} color={center ? '#fff' : selected ? accent : colors.muted} />
          </View>
          <Text style={[styles.label, selected && { color: accent, fontFamily: fonts.bold }]}>{label}</Text>
          <View style={[styles.indicator, selected && { backgroundColor: accent }]} />
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  dock: { alignItems: 'center' },
  base: { position: 'absolute', top: 77, bottom: 0, left: 0, right: 0, backgroundColor: colors.page },
  tabs: { flexDirection: 'row', alignItems: 'stretch', width: '100%', maxWidth: 560 },
  shape: { position: 'absolute', top: 0, left: 0 },
  tab: { flex: 1, minHeight: 94, alignItems: 'center', paddingHorizontal: 2, paddingTop: 31, paddingBottom: 4, gap: 3 },
  centerTab: { paddingTop: 3, gap: 6 },
  icon: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  orb: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.page,
    alignItems: 'center', justifyContent: 'center', elevation: 5,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  label: { ...type.small, textAlign: 'center', fontSize: 12, lineHeight: 16 },
  indicator: { width: 12, height: 2, borderRadius: 1 },
  pressed: { opacity: 0.72 },
});
