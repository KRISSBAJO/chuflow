import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui';
import { space, type } from '@/constants/theme';

/**
 * A section heading with the report-range chips (7d / 30d / 90d) on the right. Home and Reports
 * both use it, so the range reads the same everywhere.
 */
export function DaysRow({
  title,
  value,
  options,
  onChange,
  label,
}: {
  title: string;
  value: number;
  options: readonly number[];
  onChange: (days: number) => void;
  /** Writes one chip's label, e.g. "{count}d". */
  label: (days: number) => string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.chips}>
        {options.map((days) => (
          <Chip key={days} label={label(days)} selected={days === value} onPress={() => onChange(days)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { ...type.micro, textTransform: 'uppercase', flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 6 },
});
