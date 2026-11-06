import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, space, type } from '@/constants/theme';
import { LOCALES, LOCALE_LABELS } from '@/i18n/locales';
import { useI18n, useT } from '@/i18n/provider';
import { Icon } from './icon';
import { Sheet } from './kit';
import { toast } from './toast';
import { Caption, ListRow, tap } from './ui';

/* Language choice, the phone's version of the website's LanguagePicker. */

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale, setLocale } = useI18n();
  const t = useT('common.language');
  return (
    <Sheet visible={visible} onClose={onClose} title={t('title')}>
      <Caption style={{ marginBottom: space.sm }}>{t('hint')}</Caption>
      {LOCALES.map((option, index) => {
        const active = option === locale;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              void setLocale(option).then(() => toast.success(LOCALE_LABELS[option]));
              onClose();
            }}
            style={({ pressed }) => [styles.option, index > 0 && styles.divider, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.code}>{option.toUpperCase()}</Text>
            <Text style={[type.label, { flex: 1 }, active && { color: colors.flame }]}>{LOCALE_LABELS[option]}</Text>
            {active ? <Icon name="check" size={16} color={colors.flame} strokeWidth={2.2} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/** A settings-style row that opens the language sheet. */
export function LanguageRow({ divider }: { divider?: boolean }) {
  const { locale } = useI18n();
  const t = useT('common.language');
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListRow divider={divider} title={t('title')} subtitle={LOCALE_LABELS[locale]} left={<Icon name="globe" size={18} color={colors.muted} />} onPress={() => setOpen(true)} />
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Small inline button ("EN ▾") for screens without a settings list, like sign-in. */
export function LanguageButton() {
  const { locale } = useI18n();
  const t = useT('common.language');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('title')}
        hitSlop={8}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Icon name="globe" size={14} color={colors.muted} />
        <Text style={styles.buttonText}>{LOCALE_LABELS[locale]}</Text>
      </Pressable>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  code: { width: 30, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.faint, letterSpacing: 0.5 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong },
  buttonText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
});

