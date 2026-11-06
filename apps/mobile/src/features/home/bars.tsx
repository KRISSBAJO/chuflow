import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Meter } from '@/components/kit';
import { Caption } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import type { Tone } from '@/lib/format';

/* Small bar pieces the dashboard lists are built from; Home and Reports share them. */

/** A short bar with the number beside it, for the right side of a list row. */
export function MiniBar({ value, max, tone = 'flame', style }: { value: number; max: number; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.mini, style]}>
      <Meter value={value} max={max} tone={tone} style={styles.miniMeter} />
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * A labelled bar row: name and number on one line, the bar under them, an optional caption.
 * `value` is the formatted number; `share` goes 0–1.
 */
export function BarRow({
  title,
  value,
  share,
  caption,
  trailing,
  tone = 'flame',
  divider,
  swatch,
}: {
  title: string;
  value: string;
  share: number;
  caption?: string;
  /** Small text after the value, e.g. a percentage. */
  trailing?: string;
  tone?: Tone;
  divider?: boolean;
  /** A colour square before the title, for stage lists. */
  swatch?: string;
}) {
  return (
    <View style={[styles.bar, divider && styles.divider]}>
      <View style={styles.barTop}>
        {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
        <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.barValue}>{value}</Text>
        {trailing ? <Text style={styles.barTrailing}>{trailing}</Text> : null}
      </View>
      <Meter value={Math.max(0, share)} max={1} tone={tone} style={{ marginTop: 7 }} />
      {caption ? <Caption style={{ marginTop: 5 }}>{caption}</Caption> : null}
    </View>
  );
}

/** Small bold heading inside a section, with a count pill on the right. */
export function SubHeading({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.subheading}>
      <Text style={styles.subheadingText} numberOfLines={1}>
        {title}
      </Text>
      {typeof count === 'number' ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  miniMeter: { width: 52 },
  miniValue: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, minWidth: 26, textAlign: 'right', fontVariant: ['tabular-nums'] },
  bar: { paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  barTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  barTrailing: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, minWidth: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  subheading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingTop: space.md, paddingBottom: 2 },
  subheadingText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, flexShrink: 1 },
  pill: { minWidth: 22, height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink, fontVariant: ['tabular-nums'] },
});
