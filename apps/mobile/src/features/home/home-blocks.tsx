import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Avatar, Chip, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { Wordmark } from '@/components/wordmark';
import type { GuestListItem } from '@/lib/types';
import { TrendChart } from './trend-chart';

const PHOTO = require('@/assets/images/home-chuflow-check-in.webp');

/* ---------- Hero band ---------- */

type HeroBandProps = {
  dateLabel: string;
  greeting: string;
  name: string;
  workspace?: { name: string; pickerLabel: string; onPress?: () => void };
  scope?: string;
  alerts: number;
  alertsLabel: string;
  onAlerts: () => void;
  person?: { firstName?: string; lastName?: string } | null;
  profileLabel: string;
  onProfile: () => void;
  searchLabel?: string;
  onSearch?: () => void;
};

export function HeroBand({ dateLabel, greeting, name, workspace, scope, alerts, alertsLabel, onAlerts, person, profileLabel, onProfile, searchLabel, onSearch }: HeroBandProps) {
  const workspaceName = workspace ? <Text style={styles.workspaceName}>{workspace.name}</Text> : null;
  return (
    <View style={styles.welcome}>
      <View style={styles.topRow}>
        <Wordmark size={23} />
        <View style={styles.topActions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={alertsLabel}
            onPress={() => {
              tap();
              onAlerts();
            }}
            style={styles.bell}
          >
            <Icon name="bell" size={20} color={colors.ink} />
            {alerts > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{alerts > 9 ? '9+' : alerts}</Text>
              </View>
            ) : null}
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={profileLabel}
            onPress={() => {
              tap();
              onProfile();
            }}
            style={styles.avatarRing}
          >
            <Avatar person={person} size={38} />
          </PressableScale>
        </View>
      </View>
      <View style={styles.hero}>
        <View style={styles.copy}>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          {workspace?.onPress ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={workspace.name}
              accessibilityHint={workspace.pickerLabel}
              hitSlop={6}
              onPress={workspace.onPress}
              style={styles.workspaceRow}
            >
              {workspaceName}
              <Icon name="arrowRight" size={12} color={colors.warning} />
            </PressableScale>
          ) : workspaceName}
          {scope ? <Text style={styles.scope}>{scope}</Text> : null}
        </View>
        <Image source={PHOTO} style={styles.heroPhoto} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" accessible={false} />
      </View>
      {onSearch && searchLabel ? <HomeSearchPill label={searchLabel} onPress={onSearch} /> : null}
    </View>
  );
}

function HomeSearchPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={styles.search}
    >
      <Icon name="search" size={20} color={colors.warning} strokeWidth={2} />
      <Text style={styles.searchText}>{label}</Text>
    </PressableScale>
  );
}

/* ---------- Quick actions ---------- */

export type QuickAction = { key: string; icon: IconName; label: string; onPress: () => void; badge?: number };

export function QuickActions({ title, actions, actionLabel, onAction }: { title: string; actions: QuickAction[]; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Section title={title} action={actionLabel} onAction={onAction} />
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <PressableScale
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              tap();
              action.onPress();
            }}
            style={styles.action}
            scaleTo={0.94}
          >
            <View style={styles.actionCircle}>
              <Icon name={action.icon} size={21} color={colors.warning} strokeWidth={1.8} />
              {action.badge ? (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {action.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/* ---------- Actions required ---------- */

export function ActionsCard({
  tone,
  kicker,
  title,
  detail,
  onPress,
  hint,
}: {
  tone: 'alert' | 'calm';
  kicker: string;
  title: string;
  detail?: string;
  onPress: () => void;
  hint: string;
}) {
  const alert = tone === 'alert';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.actionsCard, !alert && styles.actionsCardCalm]}
      scaleTo={0.985}
    >
      <View style={styles.priorityCopy}>
        <View style={styles.priorityKicker}>
          {alert ? <View style={styles.priorityDot} /> : null}
          <Text style={styles.actionsKicker}>{kicker}</Text>
        </View>
        <Text style={styles.actionsTitle}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.actionsDetail}>
            {detail}
          </Text>
        ) : null}
        <Text style={styles.priorityAction}>{hint}</Text>
      </View>
      <View style={styles.forward}>
        <Icon name="arrowRight" size={17} color={colors.warning} strokeWidth={2} />
      </View>
    </PressableScale>
  );
}

/* ---------- Pulse ---------- */

export type PulseMetric = { key: string; label: string; value: string; onPress?: () => void };

export function PulseCard({
  title,
  value,
  caption,
  deltaLabel,
  deltaTone,
  series,
  tabs,
  tab,
  onTab,
  dayOptions,
  days,
  onDays,
  dayLabel,
  metrics,
}: {
  title: string;
  value: string;
  caption: string;
  deltaLabel?: string;
  deltaTone: 'up' | 'down' | 'flat';
  series: number[];
  tabs: { value: string; label: string }[];
  tab: string;
  onTab: (value: string) => void;
  dayOptions: readonly number[];
  days: number;
  onDays: (days: number) => void;
  dayLabel: (days: number) => string;
  metrics: PulseMetric[];
}) {
  const deltaColor = deltaTone === 'up' ? colors.success : deltaTone === 'down' ? colors.danger : colors.muted;
  const average = series.length ? series.reduce((sum, item) => sum + item, 0) / series.length : undefined;
  return (
    <View style={styles.pulse}>
      <Text style={styles.pulseTitle}>{title}</Text>
      <View style={styles.pulseHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.pulseValue} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.pulseCaption} numberOfLines={1}>
            {caption}
          </Text>
          {deltaLabel ? (
            <View style={styles.deltaRow}>
              {deltaTone !== 'flat' ? <Icon name={deltaTone === 'up' ? 'trending' : 'chart'} size={13} color={deltaColor} strokeWidth={2.2} /> : null}
              <Text style={[styles.delta, { color: deltaColor }]} numberOfLines={1}>
                {deltaLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {series.length ? <TrendChart values={series} baseline={average} /> : null}

      <View style={styles.pulseControls}>
        <View style={styles.chips}>
          {tabs.map((item) => (
            <Chip key={item.value} label={item.label} selected={item.value === tab} onPress={() => onTab(item.value)} />
          ))}
        </View>
        <View style={styles.chips}>
          {dayOptions.map((option) => (
            <Chip key={option} label={dayLabel(option)} selected={option === days} onPress={() => onDays(option)} />
          ))}
        </View>
      </View>

      <View style={styles.pulseMetrics}>
        {metrics.map((metric, index) => (
          <PressableScale
            key={metric.key}
            accessibilityRole={metric.onPress ? 'button' : undefined}
            accessibilityLabel={`${metric.label}, ${metric.value}`}
            disabled={!metric.onPress}
            onPress={() => {
              tap();
              metric.onPress?.();
            }}
            style={[styles.pulseMetric, index > 0 && styles.pulseMetricDivider]}
          >
            <Text style={styles.pulseMetricValue} numberOfLines={1}>
              {metric.value}
            </Text>
            <Text style={styles.pulseMetricLabel} numberOfLines={1}>
              {metric.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

/* ---------- Guest stories ---------- */

export function GuestStrip({
  title,
  guests,
  seeAll,
  onSeeAll,
  onOpen,
  nameOf,
  statusOf,
}: {
  title: string;
  guests: GuestListItem[];
  seeAll?: string;
  onSeeAll?: () => void;
  onOpen?: (id: string) => void;
  nameOf: (guest: GuestListItem) => string;
  statusOf: (guest: GuestListItem) => string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Section title={title} action={seeAll} onAction={onSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyRow} style={styles.bleed}>
        {guests.map((guest) => {
          const fresh = guest.visitStatus === 'new' || guest.visitStatus === 'first_timer' || guest.visitStatus === 'first_time';
          return (
            <PressableScale
              key={guest._id}
              accessibilityRole={onOpen ? 'button' : undefined}
              accessibilityLabel={nameOf(guest)}
              disabled={!onOpen}
              onPress={() => {
                tap();
                onOpen?.(guest._id);
              }}
              style={styles.story}
              scaleTo={0.94}
            >
              <View style={[styles.storyRing, fresh && styles.storyRingFresh]}>
                <View style={styles.storyInner}>
                  <Avatar person={guest} size={56} />
                </View>
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {nameOf(guest)}
              </Text>
              <Text style={styles.storyStatus} numberOfLines={1}>
                {statusOf(guest)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.page },

  welcome: { gap: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 0, right: 0, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#ffffff' },
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 24, backgroundColor: colors.surface },
  heroPhoto: { width: '37%', maxWidth: 180, aspectRatio: 0.94, borderRadius: 18, backgroundColor: colors.surfaceStrong },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  date: { ...type.micro, color: colors.muted, marginBottom: 5 },
  greeting: { ...type.body, color: colors.muted },
  name: { fontFamily: fonts.semibold, fontSize: 31, lineHeight: 36, letterSpacing: -0.8, color: colors.ink, marginBottom: 3 },
  workspaceRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 5 },
  workspaceName: { ...type.small, fontFamily: fonts.semibold, color: colors.ink, flexShrink: 1 },
  scope: type.small,
  search: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.page },
  searchText: { ...type.body, flex: 1, color: colors.text },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md, marginTop: space.sm },
  action: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 3 },
  actionCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  actionBadge: { position: 'absolute', top: -4, right: -6, minWidth: 19, height: 19, paddingHorizontal: 3, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.page },
  actionBadgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#ffffff' },
  actionLabel: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.ink, textAlign: 'center' },

  actionsCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 20, backgroundColor: '#fbf2e8', borderWidth: StyleSheet.hairlineWidth, borderColor: '#eedbcc' },
  actionsCardCalm: { backgroundColor: colors.surface, borderColor: colors.hairline },
  priorityCopy: { flex: 1, minWidth: 0, gap: 5 },
  priorityKicker: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  priorityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  actionsKicker: { ...type.micro, flexShrink: 1, textTransform: 'uppercase', color: colors.text },
  actionsTitle: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, color: colors.ink },
  actionsDetail: type.body,
  priorityAction: { ...type.label, color: colors.warning, marginTop: 4 },
  forward: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },

  pulse: { borderRadius: 24, padding: space.lg, gap: space.md, backgroundColor: colors.page, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  pulseTitle: { ...type.micro, textTransform: 'uppercase' },
  pulseHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pulseValue: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  pulseCaption: type.small,
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  delta: { fontFamily: fonts.medium, fontSize: 13 },
  pulseControls: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pulseMetrics: { flexDirection: 'row', marginTop: 2, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  pulseMetric: { flex: 1, paddingHorizontal: 6 },
  pulseMetricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairlineStrong },
  pulseMetricValue: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  pulseMetricLabel: { ...type.micro, fontFamily: fonts.regular, letterSpacing: 0, color: colors.muted, marginTop: 1 },

  storyRow: { paddingHorizontal: space.page, gap: 14, paddingVertical: 4 },
  story: { width: 72, alignItems: 'center', gap: 6 },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingFresh: { borderColor: colors.flame },
  storyInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  storyName: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink, textAlign: 'center', maxWidth: 72 },
  storyStatus: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, textAlign: 'center', maxWidth: 72, marginTop: -3 },
});
