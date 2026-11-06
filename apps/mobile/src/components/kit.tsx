import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import type { Tone } from '@/lib/format';
import { Icon, type IconName } from './icon';
import { Caption, tap } from './ui';

/*
 * Second half of the phone UI kit: the pieces the website's dashboards and desks are built from
 * (stat tiles, meters, timelines, pickers, sheets), at a phone's scale. Feature modules compose
 * these rather than adding their own primitives.
 */

const TONE_FG: Record<Tone, string> = {
  neutral: colors.ink,
  flame: colors.flame,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
};

const TONE_BG: Record<Tone, string> = {
  neutral: colors.surface,
  flame: colors.flameSoft,
  success: colors.successBg,
  warning: colors.warningBg,
  danger: colors.dangerBg,
  info: colors.infoBg,
};

/* ---------- Stats ---------- */

/** A number with a label, like the website's metric cards. Put several in a StatGrid. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onPress,
  style,
}: {
  label: string;
  value: string | number | undefined;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      <Text style={[styles.statValue, tone !== 'neutral' && { color: TONE_FG[tone] }]} numberOfLines={1}>
        {value ?? '—'}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={styles.statHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.stat, style]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }, style]}
    >
      {body}
    </Pressable>
  );
}

/** Two tiles per row. */
export function StatGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <View style={[styles.statGrid, columns === 3 && { gap: space.sm }]}>{children}</View>;
}

/** Thin progress bar; turns amber near full and red at full. */
export function Meter({ value, max, tone, style }: { value: number; max: number; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const auto: Tone = ratio >= 1 ? 'danger' : ratio >= 0.85 ? 'warning' : 'success';
  const color = TONE_FG[tone ?? auto];
  return (
    <View style={[styles.meter, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.meterFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

/** A small pulsing-style status dot. */
export function LiveDot({ tone = 'success', size = 8 }: { tone?: Tone; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: TONE_FG[tone] }} />;
}

/* ---------- Timeline, key/value ---------- */

export type TimelineItem = { key: string; title: string; subtitle?: string; at?: string; tone?: Tone; icon?: IconName };

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={item.key} style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, { backgroundColor: TONE_FG[item.tone ?? 'neutral'] }]} />
            {index < items.length - 1 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineBody}>
            <View style={styles.timelineTop}>
              <Text style={[type.label, { flex: 1 }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.at ? <Caption>{item.at}</Caption> : null}
            </View>
            {item.subtitle ? <Caption numberOfLines={2}>{item.subtitle}</Caption> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function KeyValue({ rows }: { rows: { label: string; value?: ReactNode; onPress?: () => void }[] }) {
  const visible = rows.filter((row) => row.value !== undefined && row.value !== null && row.value !== '');
  return (
    <View>
      {visible.map((row, index) => {
        const content = (
          <>
            <Caption>{row.label}</Caption>
            {typeof row.value === 'string' || typeof row.value === 'number' ? (
              <Text style={[type.body, { color: colors.ink, marginTop: 1 }]}>{row.value}</Text>
            ) : (
              <View style={{ marginTop: 3 }}>{row.value}</View>
            )}
          </>
        );
        const style = [styles.kv, index > 0 && styles.kvDivider];
        return row.onPress ? (
          <Pressable key={row.label} onPress={row.onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.6 }]}>
            {content}
          </Pressable>
        ) : (
          <View key={row.label} style={style}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

/* ---------- Inputs ---------- */

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const t = useT('common');
  return (
    <View style={styles.search}>
      <Icon name="search" size={16} color={colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('actions.search')}
        placeholderTextColor="#b0ada6"
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmit}
        clearButtonMode="while-editing"
      />
      {value && Platform.OS !== 'ios' ? (
        <Pressable accessibilityLabel={t('actions.clear')} hitSlop={8} onPress={() => onChangeText('')}>
          <Icon name="close" size={14} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A labelled switch row. */
export function SwitchRow({
  icon,
  title,
  body,
  value,
  onChange,
  disabled,
  divider,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[styles.switchRow, divider && styles.kvDivider]}>
      {icon ? <Icon name={icon} size={18} color={colors.muted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{title}</Text>
        {body ? <Caption>{body}</Caption> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          tap();
          onChange(next);
        }}
        trackColor={{ true: colors.flame, false: '#dedbd4' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/* ---------- Sheets ---------- */

/** Bottom sheet. Children scroll inside if they overflow. */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const t = useT('common');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('actions.close')} style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <View style={styles.grabber} />
        {title ? (
          <View style={styles.sheetHeader}>
            <Text style={type.title}>{title}</Text>
            <Pressable accessibilityLabel={t('actions.close')} hitSlop={10} onPress={onClose}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
        <View style={{ maxHeight: 460 }}>{children}</View>
        {footer ? <View style={{ marginTop: space.md }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

export type PickerOption<T extends string> = { value: T; label: string; hint?: string; icon?: IconName };

/**
 * A field that opens a bottom sheet of options, for lists too long for chips (branches, service
 * types, categories, members). Shows a search box when there are many options.
 */
export function SheetPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  error,
  hint,
  searchable,
}: {
  label: string;
  value: T | '' | null | undefined;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  searchable?: boolean;
}) {
  const t = useT('common');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const showSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.flame }}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          tap();
          setQuery('');
          setOpen(true);
        }}
        style={({ pressed }) => [styles.pickerField, error ? { borderColor: colors.danger } : null, pressed && { backgroundColor: colors.surface }]}
      >
        {selected?.icon ? <Icon name={selected.icon} size={16} color={colors.muted} /> : null}
        <Text style={[styles.pickerValue, !selected && { color: '#b0ada6' }]} numberOfLines={1}>
          {selected?.label ?? placeholder ?? t('actions.select')}
        </Text>
        <Icon name="chevronRight" size={15} color={colors.faint} />
      </Pressable>
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={type.small}>{hint}</Text> : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {showSearch ? (
          <View style={{ marginBottom: space.sm }}>
            <SearchBar value={query} onChangeText={setQuery} autoFocus />
          </View>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(option) => option.value}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const active = item.value === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tap();
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, index > 0 && styles.kvDivider, pressed && { opacity: 0.6 }]}
              >
                {item.icon ? <Icon name={item.icon} size={17} color={colors.muted} /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[type.label, active && { color: colors.flame }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.hint ? <Caption numberOfLines={1}>{item.hint}</Caption> : null}
                </View>
                {active ? <Icon name="check" size={16} color={colors.flame} strokeWidth={2.2} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Caption style={{ textAlign: 'center', paddingVertical: space.lg }}>{t('state.noMatches')}</Caption>}
        />
      </Sheet>
    </View>
  );
}

/** Previous / next day control with a label; `max` (default today) stops the forward arrow. */
export function DateStepper({ value, onChange, label, max, min }: { value: Date; onChange: (date: Date) => void; label: string; max?: Date | null; min?: Date | null }) {
  const t = useT('common');
  const limit = max === undefined ? new Date() : max;
  const atMax = !!limit && sameDay(value, limit);
  const atMin = !!min && sameDay(value, min);
  const shift = (days: number) => {
    const next = new Date(value);
    next.setDate(value.getDate() + days);
    tap();
    onChange(next);
  };
  return (
    <View style={styles.dateRow}>
      <Pressable accessibilityLabel={t('actions.back')} disabled={atMin} onPress={() => shift(-1)} style={[styles.dateButton, atMin && { opacity: 0.3 }]} hitSlop={8}>
        <Icon name="chevronLeft" size={16} color={colors.ink} />
      </Pressable>
      <Text style={[type.label, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {label}
      </Text>
      <Pressable accessibilityLabel={t('actions.next')} disabled={atMax} onPress={() => shift(1)} style={[styles.dateButton, atMax && { opacity: 0.3 }]} hitSlop={8}>
        <Icon name="chevronRight" size={16} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* ---------- Misc ---------- */

/** Soft tinted panel for a status message with an optional action on the right. */
export function Banner({ tone = 'info', icon = 'info', title, body, action }: { tone?: Tone; icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={[styles.banner, { backgroundColor: TONE_BG[tone] }]}>
      <Icon name={icon} size={17} color={TONE_FG[tone]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.label, { color: TONE_FG[tone] }]}>{title}</Text>
        {body ? <Text style={[type.small, { color: TONE_FG[tone], opacity: 0.9 }]}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** Icon + label tile for a grid of destinations (the More hub, quick actions). */
export function ActionTile({ icon, label, hint, onPress, badge, tone = 'neutral' }: { icon: IconName; label: string; hint?: string; onPress: () => void; badge?: number; tone?: 'neutral' | 'dark' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.tileIcon, tone === 'dark' && { backgroundColor: colors.ink }]}>
        <Icon name={icon} size={18} color={tone === 'dark' ? '#ffffff' : colors.ink} />
        {badge ? (
          <View style={styles.tileBadge}>
            <Text style={styles.tileBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={type.label} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Caption numberOfLines={2}>{hint}</Caption> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, minWidth: 0 },
  statValue: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.text, marginTop: 2 },
  statHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.faint, marginTop: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  meter: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  timelineRow: { flexDirection: 'row', gap: space.md },
  timelineRail: { width: 14, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineLine: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.hairlineStrong, marginVertical: 3 },
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  kv: { paddingVertical: 10 },
  kvDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink, height: '100%' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.35)' },
  sheet: { backgroundColor: colors.page, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: space.page, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairlineStrong, marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, marginBottom: 4 },
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, padding: 4 },
  dateButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, padding: space.md },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 6, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, minWidth: 0 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.inset, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileBadge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center' },
  tileBadgeText: { fontFamily: fonts.semibold, fontSize: 9.5, color: '#ffffff' },
});
