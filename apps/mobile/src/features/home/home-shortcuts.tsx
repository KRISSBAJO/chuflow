import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { QuickActions, type QuickAction } from './home-blocks';

const LIMIT = 4;

export function HomeShortcuts({ actions, storageKey }: { actions: QuickAction[]; storageKey: string }) {
  const t = useT('home.shortcuts');
  const tc = useT('common');
  const [pins, setPins] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPins([...new Set(parsed.filter((key): key is string => typeof key === 'string'))].slice(0, LIMIT));
      }
    }).catch(() => undefined).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [storageKey]);

  const byKey = new Map(actions.map((action) => [action.key, action]));
  const allowedPins = pins.filter((key) => byKey.has(key));
  const shown = [...allowedPins.map((key) => byKey.get(key)!), ...actions.filter(({ key }) => !allowedPins.includes(key))].slice(0, LIMIT);

  async function save() {
    if (!draft || saving) return;
    const next = draft.filter((key) => byKey.has(key));
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setPins(next);
      setDraft(null);
    } catch {
      toast.error(t('pinFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <QuickActions title={t('title')} actions={shown} actionLabel={ready ? t('pinTitle') : undefined} onAction={() => setDraft(allowedPins)} />
      <Sheet visible={draft !== null} title={t('pinTitle')} onClose={() => { if (!saving) setDraft(null); }}
        footer={<Button label={tc('actions.save')} loading={saving} onPress={() => void save()} />}>
        <ScrollView>
          <Caption style={styles.hint}>{t('pinHint')}</Caption>
          {actions.map((action) => {
            const selected = draft?.includes(action.key) ?? false;
            const disabled = saving || (!selected && (draft?.length ?? 0) >= LIMIT);
            return (
              <Pressable key={action.key} accessibilityRole="checkbox" aria-checked={selected} accessibilityState={{ checked: selected, disabled }}
                disabled={disabled} style={[styles.option, disabled && styles.disabled]}
                onPress={() => setDraft((current) => {
                  if (!current) return null;
                  if (current.includes(action.key)) return current.filter((key) => key !== action.key);
                  return current.length < LIMIT ? [...current, action.key] : current;
                })}>
                <Icon name={action.icon} size={19} color={colors.warning} />
                <Text style={styles.label}>{action.label}</Text>
                <View style={[styles.check, selected && styles.selected]}>
                  {selected ? <Icon name="check" size={14} color={colors.page} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  label: { ...type.label, flex: 1 },
  check: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  disabled: { opacity: 0.55 },
});
