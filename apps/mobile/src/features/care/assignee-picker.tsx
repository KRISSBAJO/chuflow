import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { SearchBar, Sheet } from '@/components/kit';
import { Avatar, Caption, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage, query } from '@/lib/api';
import type { CarePerson } from './types';

/**
 * Picks a care worker from GET /care/assignees, which searches by name or email (two letters or
 * more) within the branch. Like the website's CarePicker, but as a field that opens a sheet.
 */
export function AssigneePicker({
  label,
  branchId,
  value,
  onChange,
  leadersOnly,
}: {
  label: string;
  branchId: string;
  value: CarePerson | null;
  onChange: (person: CarePerson | null) => void;
  leadersOnly?: boolean;
}) {
  const t = useT('care.assignee');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Results are kept with the term they answer, so typing on never shows stale matches.
  const [result, setResult] = useState<{ term: string; items: CarePerson[]; error?: string }>({ term: '', items: [] });
  const term = q.trim();
  const searching = term.length >= 2;
  const matches = searching && result.term === term ? result.items : [];
  const loading = searching && result.term !== term;

  useEffect(() => {
    if (!open || term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      api
        .get<CarePerson[]>(`/care/assignees${query({ branchId, q: term, leadersOnly: leadersOnly ? 'true' : undefined })}`)
        .then((items) => {
          if (active) setResult({ term, items });
        })
        .catch((cause: unknown) => {
          if (active) setResult({ term, items: [], error: errorMessage(cause) });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, open, branchId, leadersOnly]);

  const choose = (person: CarePerson | null) => {
    tap();
    onChange(person);
    setOpen(false);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          tap();
          setQ('');
          setOpen(true);
        }}
        style={({ pressed }) => [styles.pickerField, pressed && { backgroundColor: colors.surface }]}
      >
        {value ? <Avatar person={value} size={24} /> : null}
        <Text style={[styles.pickerValue, !value && { color: '#b0ada6' }]} numberOfLines={1}>
          {value ? `${value.firstName} ${value.lastName}` : t('none')}
        </Text>
        <Icon name="chevronRight" size={15} color={colors.faint} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={{ marginBottom: space.sm }}>
          <SearchBar value={q} onChangeText={setQ} placeholder={t('placeholder')} autoFocus />
        </View>
        <FlatList
          data={matches}
          keyExtractor={(person) => person._id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: !value }} onPress={() => choose(null)} style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}>
              <View style={styles.noneIcon}>
                <Icon name="user" size={15} color={colors.muted} />
              </View>
              <Text style={[type.label, { flex: 1 }, !value && { color: colors.flame }]}>{t('none')}</Text>
              {!value ? <Icon name="check" size={16} color={colors.flame} strokeWidth={2.2} /> : null}
            </Pressable>
          }
          renderItem={({ item }) => {
            const active = item._id === value?._id;
            return (
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => choose(item)} style={({ pressed }) => [styles.option, styles.divider, pressed && { opacity: 0.6 }]}>
                <Avatar person={item} size={28} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[type.label, active && { color: colors.flame }]} numberOfLines={1}>
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.email ? <Caption numberOfLines={1}>{item.email}</Caption> : null}
                </View>
                {active ? <Icon name="check" size={16} color={colors.flame} strokeWidth={2.2} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Caption style={{ textAlign: 'center', paddingVertical: space.lg }}>
              {!searching ? t('hint') : loading ? t('searching') : (result.error ?? t('noMatches'))}
            </Caption>
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
  },
  pickerValue: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  noneIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
});
