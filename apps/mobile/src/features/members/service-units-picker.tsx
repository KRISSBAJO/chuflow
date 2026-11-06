import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/kit';
import { Button, Caption, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { query } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { unitBranchId, type ServiceUnitSummary } from './types';

/**
 * Multi-select of a branch's service groups, loaded from GET /service-units. A field that opens a
 * sheet of check rows; the chosen names show under the field.
 */
export function ServiceUnitsPicker({
  branchId,
  value,
  onChange,
  known = [],
}: {
  branchId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Units already on the member, so inactive ones they belong to stay listed. */
  known?: ServiceUnitSummary[];
}) {
  const t = useT('members.form');
  const tc = useT('common');
  const [open, setOpen] = useState(false);
  const units = useApi<ServiceUnitSummary[]>(branchId ? `/service-units${query({ branchId })}` : null);

  const options = useMemo(() => {
    const chosen = new Set(value);
    const list = (units.data ?? []).filter((unit) => !branchId || !unitBranchId(unit) || unitBranchId(unit) === branchId);
    const byId = new Map(list.map((unit) => [unit._id, unit]));
    for (const unit of known) if (!byId.has(unit._id)) byId.set(unit._id, unit);
    return [...byId.values()].filter((unit) => unit.isActive !== false || chosen.has(unit._id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [units.data, known, branchId, value]);

  const selectedNames = options.filter((unit) => value.includes(unit._id)).map((unit) => unit.name);

  function toggle(id: string) {
    tap();
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{t('serviceUnits')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('serviceUnits')}
        disabled={!branchId}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.pickerField, !branchId && { opacity: 0.5 }, pressed && { backgroundColor: colors.surface }]}
      >
        <Text style={[styles.pickerValue, !selectedNames.length && { color: '#b0ada6' }]} numberOfLines={2}>
          {selectedNames.length ? selectedNames.join('; ') : t('serviceUnitsPlaceholder')}
        </Text>
        {selectedNames.length ? <Caption>{t('serviceUnitsCount', { count: selectedNames.length })}</Caption> : null}
        <Icon name="chevronRight" size={15} color={colors.faint} />
      </Pressable>
      <Text style={type.small}>{t('serviceUnitsHint')}</Text>

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('serviceUnits')} footer={<Button label={tc('actions.done')} onPress={() => setOpen(false)} />}>
        <FlatList
          data={options}
          keyExtractor={(unit) => unit._id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const active = value.includes(item._id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => toggle(item._id)}
                style={({ pressed }) => [styles.option, index > 0 && styles.divider, pressed && { opacity: 0.6 }]}
              >
                <View style={[styles.check, active && styles.checkOn]}>{active ? <Icon name="check" size={13} color="#ffffff" strokeWidth={2.4} /> : null}</View>
                <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
                  {item.name}
                  {item.isActive === false ? t('inactiveSuffix') : ''}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Caption style={{ textAlign: 'center', paddingVertical: space.lg }}>{units.loading ? tc('state.loading') : (units.error ?? t('serviceUnitsEmpty'))}</Caption>
          }
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.inset,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickerValue: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#c9c6bf', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
