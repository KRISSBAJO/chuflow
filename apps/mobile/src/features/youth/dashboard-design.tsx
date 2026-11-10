import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/kit';
import { Button, Chip } from '@/components/ui';
import { toast } from '@/components/toast';
import { type } from '@/constants/theme';
import { useT } from '@/i18n/provider';

const themes = {
  sunrise: { surface: '#fff7ec', accent: '#974020', tint: '#ffead8' },
  lavender: { surface: '#f5efff', accent: '#624187', tint: '#eee1fc' },
  evergreen: { surface: '#edf8f1', accent: '#225a43', tint: '#daf0e1' },
} as const;
const characters = {
  none: null,
  esther: { image: require('../../../assets/images/youth-esther.webp'), reference: 'esther' },
  daniel: { image: require('../../../assets/images/youth-daniel.webp'), reference: 'daniel' },
  deborah: { image: require('../../../assets/images/youth-deborah.webp'), reference: 'deborah' },
} as const;
const widgets = ['activity', 'updates', 'groups', 'journey', 'service'] as const;
type Theme = keyof typeof themes;
type Character = keyof typeof characters;
type Widget = (typeof widgets)[number];
type Design = { theme: Theme; character: Character; widgets: Widget[] };
const defaultDesign: Design = { theme: 'sunrise', character: 'none', widgets: ['activity', 'updates', 'groups'] };

export function useYouthDesign(storageKey: string) {
  const t = useT('youth.participantHome.design');
  const [saved, setSaved] = useState<{ key: string; value: Design }>();
  const [draft, setDraft] = useState<Design>();
  const [saving, setSaving] = useState(false);
  const design = saved?.key === storageKey ? saved.value : defaultDesign;

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(raw => {
      if (!active) return;
      const value = raw ? JSON.parse(raw) as Partial<Design> | null : null;
      setSaved({ key: storageKey, value: {
        theme: value?.theme && Object.hasOwn(themes, value.theme) ? value.theme : defaultDesign.theme,
        character: value?.character && Object.hasOwn(characters, value.character) ? value.character : defaultDesign.character,
        widgets: Array.isArray(value?.widgets) ? widgets.filter(widget => value.widgets?.includes(widget)) : defaultDesign.widgets,
      } });
    }).catch(() => { if (active) setSaved({ key: storageKey, value: defaultDesign }); });
    return () => { active = false; };
  }, [storageKey]);

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(draft));
      setSaved({ key: storageKey, value: draft });
      setDraft(undefined);
    } catch { toast.error(t('failed')); }
    finally { setSaving(false); }
  }

  const palette = themes[design.theme];
  const character = characters[design.character];
  return {
    palette,
    widgets: design.widgets,
    open: saved?.key === storageKey ? () => setDraft(design) : undefined,
    spotlight: character ? <View style={[styles.spotlight, { backgroundColor: palette.surface }]}>
      <Image source={character.image} contentFit="cover" style={styles.portrait} accessible={false} />
      <View style={styles.copy}>
        <Text style={[type.micro, { color: palette.accent }]}>{t('spotlight')}</Text>
        <Text accessibilityRole="header" style={type.title}>{t(`characters.${character.reference}`)}</Text>
        <Text style={type.body}>{t(`stories.${character.reference}`)}</Text>
        <Text style={type.small}>{t(`references.${character.reference}`)}</Text>
      </View>
    </View> : null,
    panel: <Sheet visible={!!draft} title={t('title')} onClose={() => { if (!saving) setDraft(undefined); }}
      footer={<Button label={t('save')} loading={saving} onPress={() => void save()} />}>
      {draft ? <ScrollView contentContainerStyle={styles.panel}>
        <Text style={type.small}>{t('device')}</Text>
        <Text accessibilityRole="header" style={type.title}>{t('theme')}</Text>
        <View style={styles.choices}>{(Object.keys(themes) as Theme[]).map(theme =>
          <Chip key={theme} label={t(`themes.${theme}`)} selected={draft.theme === theme} onPress={() => setDraft({ ...draft, theme })} />)}</View>
        <Text accessibilityRole="header" style={type.title}>{t('character')}</Text>
        <View style={styles.choices}>{(Object.keys(characters) as Character[]).map(characterKey =>
          <Chip key={characterKey} label={t(`characters.${characterKey}`)} selected={draft.character === characterKey}
            onPress={() => setDraft({ ...draft, character: characterKey })} />)}</View>
        <Text accessibilityRole="header" style={type.title}>{t('widgets')}</Text>
        {widgets.map(widget => <Button key={widget} variant="secondary" size="sm" icon={draft.widgets.includes(widget) ? 'check' : 'plus'}
          accessibilityState={{ selected: draft.widgets.includes(widget) }} label={t(`cards.${widget}`)}
          onPress={() => setDraft({ ...draft, widgets: draft.widgets.includes(widget) ? draft.widgets.filter(item => item !== widget) : [...draft.widgets, widget] })} />)}
      </ScrollView> : null}
    </Sheet>,
  };
}

const styles = StyleSheet.create({
  panel: { gap: 10, paddingBottom: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spotlight: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 13 },
  portrait: { width: 82, height: 94, borderRadius: 13 },
  copy: { flex: 1, gap: 3 },
});
