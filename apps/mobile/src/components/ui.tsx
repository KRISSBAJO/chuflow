import * as Haptics from 'expo-haptics';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { initials as personInitials, type Tone } from '@/lib/format';
import { Icon, type IconName } from './icon';
import { PressableScale, Reveal } from './motion';

/* Shared layout and typography for ChuFlow's phone screens. */

export function tap(style: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (style === 'success' || style === 'warning') {
    void Haptics.notificationAsync(
      style === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
  } else {
    void Haptics.impactAsync(style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }
}

/* ---------- Type ---------- */

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function Title({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[type.display, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Heading({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[type.title, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[type.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Caption({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={[type.small, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Small section heading with an optional text action on the right. */
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Screen title with an optional subtitle and a right-hand control. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Title>{title}</Title>
        {subtitle ? (
          <Caption style={{ marginTop: 3 }}>
            {subtitle}
          </Caption>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* ---------- Layout ---------- */

type ScreenProps = {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Adds top safe-area padding; off for screens that sit under a stack header. */
  safeTop?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
};

export function Screen({ children, refreshing = false, onRefresh, safeTop = true, contentStyle, footer }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, safeTop && { paddingTop: insets.top }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.screenContent,
          { paddingTop: space.md, paddingBottom: space.xxl + (footer ? 84 : 0) },
          contentStyle,
        ]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.flame} colors={[colors.flame]} /> : undefined
        }
      >
        <Reveal distance={10} style={[styles.screenContent, { paddingHorizontal: 0 }, contentStyle]}>
          {children}
        </Reveal>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{footer}</View> : null}
    </View>
  );
}

/** Soft gray panel. Use sparingly; plain lists with hairlines read lighter. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'flame' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const BUTTON_HEIGHT = { sm: 32, md: 40, lg: 46 } as const;

export function Button({ label, variant = 'primary', icon, loading, size = 'md', disabled, style, onPress, ...rest }: ButtonProps) {
  const fg = variant === 'secondary' || variant === 'ghost' ? colors.ink : '#ffffff';
  const background =
    variant === 'primary' ? colors.ink : variant === 'flame' ? colors.flame : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.inset : 'transparent';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={(event) => {
        tap();
        onPress?.(event);
      }}
      scaleTo={0.96}
      dim={0.85}
      baseOpacity={disabled ? 0.4 : 1}
      style={[
        styles.button,
        { minHeight: BUTTON_HEIGHT[size], paddingHorizontal: size === 'sm' ? 12 : 16, backgroundColor: background },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.hairlineStrong },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 15 : 17} color={fg} strokeWidth={1.9} />
      ) : null}
      <Text style={[styles.buttonLabel, { color: fg, fontSize: size === 'sm' ? 14 : 15 }]}>{label}</Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge,
  size = 36,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, pressed && { backgroundColor: colors.surfaceStrong }]}
    >
      <Icon name={icon} size={18} color={colors.ink} />
      {badge ? (
        <View style={styles.dotBadge}>
          <Text style={styles.dotBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Small round action, e.g. Call / WhatsApp / Text on a list row. */
export function RoundAction({ icon, label, onPress, tone = 'plain' }: { icon: IconName; label: string; onPress: () => void; tone?: 'plain' | 'dark' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.round, tone === 'dark' && { backgroundColor: colors.ink, borderColor: colors.ink }, pressed && { opacity: 0.6 }]}
    >
      <Icon name={icon} size={16} color={tone === 'dark' ? '#ffffff' : colors.ink} />
    </Pressable>
  );
}

/* ---------- Badges, avatars ---------- */

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceStrong, fg: colors.text },
  flame: { bg: colors.flameSoft, fg: '#9a3412' },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  info: { bg: colors.infoBg, fg: colors.info },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[styles.badgeText, { color: TONES[tone].fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ person, size = 34 }: { person?: { firstName?: string; lastName?: string } | null; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>{personInitials(person)}</Text>
    </View>
  );
}

/* ---------- Lists ---------- */

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  chevron = !!onPress,
  divider = false,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  /** Hairline above the row, for stacked rows. */
  divider?: boolean;
}) {
  const body = (
    <>
      {left}
      <View style={styles.rowText}>
        <Text style={type.label}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.body, { color: colors.muted, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevronRight" size={15} color={colors.faint} /> : null}
    </>
  );

  const rowStyle = [styles.row, divider && styles.rowDivider];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      scaleTo={0.985}
      dim={0.55}
      style={rowStyle}
    >
      {body}
    </PressableScale>
  );
}

/* ---------- Forms ---------- */

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string | null; required?: boolean };

export const Field = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(function Field({ label, hint, error, required, style, ...input }, ref) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.flame }}> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor="#b0ada6"
        style={[styles.input, input.multiline && styles.inputMultiline, error ? { borderColor: colors.danger } : null, style]}
        {...input}
      />
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={type.small}>{hint}</Text> : null}
    </View>
  );
});

/** Text-tab filter: quiet labels with an underline on the active one. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            {typeof option.count === 'number' && option.count > 0 ? <Text style={[styles.segmentCount, active && { color: colors.flame }]}>{option.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Pill choice used for pickers (services, outcomes, reminders). */
export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.chip, selected && styles.chipActive]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? '#ffffff' : colors.ink} /> : null}
      <Text style={[styles.chipText, selected && { color: '#ffffff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- States ---------- */

export function EmptyState({ icon = 'sparkle', title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={20} color={colors.faint} />
      <Text style={[type.label, { textAlign: 'center', marginTop: 4 }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: 'center', maxWidth: 280 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT('common');
  return (
    <EmptyState
      icon="cloudOff"
      title={t('state.loadError')}
      body={message}
      action={onRetry ? <Button label={t('actions.retry')} variant="secondary" size="sm" icon="refresh" onPress={onRetry} /> : undefined}
    />
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.flame} />
    </View>
  );
}

export function Notice({ tone = 'info', icon = 'alert', children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <View style={[styles.notice, { backgroundColor: TONES[tone].bg }]}>
      <Icon name={icon} size={15} color={TONES[tone].fg} />
      <Text style={[styles.noticeText, { color: TONES[tone].fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  screenContent: { paddingHorizontal: space.page, gap: space.lg },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.page,
    paddingTop: space.md,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm },
  sectionTitle: { ...type.micro, flexShrink: 1, textTransform: 'uppercase' },
  sectionAction: { ...type.label, color: colors.warning },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg },
  cardPadded: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
  button: { flexDirection: 'row', gap: 7, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontFamily: fonts.medium, flexShrink: 1, textAlign: 'center', paddingVertical: 5 },
  iconButton: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dotBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.flame,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotBadgeText: { fontFamily: fonts.semibold, fontSize: 9, color: '#ffffff' },
  round: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.medium, fontSize: 12 },
  avatar: { backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  rowText: { flex: 1, minWidth: 0 },
  field: { gap: 6 },
  fieldLabel: { ...type.label, color: colors.text },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.inset,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 84, paddingTop: 11, textAlignVertical: 'top' },
  segmented: { gap: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -StyleSheet.hairlineWidth },
  segmentActive: { borderBottomColor: colors.ink },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.faint },
  segmentTextActive: { color: colors.ink },
  segmentCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.faint },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.inset,
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  empty: { alignItems: 'center', gap: 4, paddingVertical: 32, paddingHorizontal: space.xl },
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  notice: { flexDirection: 'row', gap: space.sm, alignItems: 'center', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: space.md },
  noticeText: { ...type.body, flex: 1, fontFamily: fonts.medium },
});
