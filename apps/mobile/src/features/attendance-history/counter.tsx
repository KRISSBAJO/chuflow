import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { tap } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';

/** Minus / value / plus stepper for correcting a count, the same control as the door counter. */
export function Counter({ label, value, onChange, divider }: { label: string; value: number; onChange: (next: number) => void; divider: boolean }) {
  const t = useT('attendanceHistory.detail');
  const step = (delta: number) => {
    tap();
    onChange(Math.max(0, value + delta));
  };
  return (
    <View style={[styles.counter, divider && styles.divider]}>
      <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('removeOne', { label })}
        onPress={() => step(-1)}
        onLongPress={() => step(-10)}
        disabled={value === 0}
        style={({ pressed }) => [styles.stepper, value === 0 && { opacity: 0.35 }, pressed && { backgroundColor: colors.surfaceStrong }]}
        hitSlop={6}
      >
        <Icon name="minus" size={16} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <TextInput
        accessibilityLabel={t('countFor', { label })}
        value={String(value)}
        onChangeText={(text) => onChange(Math.max(0, Number(text.replace(/\D/g, '')) || 0))}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        style={styles.value}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('addOne', { label })}
        accessibilityHint={t('holdForTen')}
        onPress={() => step(1)}
        onLongPress={() => step(10)}
        style={({ pressed }) => [styles.stepper, styles.stepperPlus, pressed && { opacity: 0.8 }]}
        hitSlop={6}
      >
        <Icon name="plus" size={16} color="#ffffff" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  stepper: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  stepperPlus: { backgroundColor: colors.ink, borderColor: colors.ink },
  value: { width: 52, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'], paddingVertical: 2 },
});
