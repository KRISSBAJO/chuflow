import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Avatar, Chip, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import type { GuestListItem } from '@/lib/types';
import { TrendChart } from './trend-chart';

const PHOTO = require('@/assets/images/home-chuflow-check-in.webp');

/* ---------- Hero band ---------- */

type HeroBandProps = {
  dateLabel: string;
  greeting: string;
  name: string;
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

export function HeroBand({ dateLabel, greeting, name, scope, alerts, alertsLabel, onAlerts, person, profileLabel, onProfile, searchLabel, onSearch }: HeroBandProps) {
  return (
    <View style={styles.bandWrap}>
      <View style={styles.hero}>
        <View style={styles.heroAccent} pointerEvents="none" />
        <Image source={PHOTO} style={styles.heroPhoto} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" accessible={false} />
        <View style={styles.topRow}>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={14} color="#ffffff" />
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
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
              <Icon name="bell" size={20} color="#ffffff" />
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
        <View style={styles.copy}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
          {scope ? <Text style={styles.scope}>{scope}</Text> : null}
        </View>
      </View>
      {onSearch && searchLabel ? <HomeSearchPill label={searchLabel} onPress={onSearch} /> : null}
    </View>
  );
}

const SEARCH_TIPS = ['name', 'phone', 'branch', 'email'] as const;
const SEARCH_TIP_INTERVAL = 5000;
const useNativeAnimationDriver = Platform.OS !== 'web';

function HomeSearchPill({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useT('home.searchTips');
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [tipIndex, setTipIndex] = useState(0);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!focused || reduceMotion) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: useNativeAnimationDriver, isInteraction: false }).start(({ finished }) => {
        if (!finished) return;
        setTipIndex((index) => (index + 1) % (SEARCH_TIPS.length + 1));
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: useNativeAnimationDriver, isInteraction: false }).start();
      });
    }, SEARCH_TIP_INTERVAL);
    return () => {
      clearInterval(timer);
      opacity.stopAnimation();
      opacity.setValue(1);
    };
  }, [focused, opacity, reduceMotion]);

  const tip = reduceMotion || tipIndex === 0 ? label : t(SEARCH_TIPS[tipIndex - 1]);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={reduceMotion ? 1 : 0.985}
      onPress={() => {
        tap();
        onPress();
      }}
      style={styles.searchWrap}
    >
      <LinearGradient colors={[colors.flameFrom, colors.flameTo, '#f5c29d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchRing}>
        <View style={styles.search}>
          <LinearGradient colors={[colors.flameFrom, colors.flameTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchLens}>
            <Icon name="search" size={20} color="#ffffff" strokeWidth={2.2} />
          </LinearGradient>
          <Animated.Text style={[styles.searchText, { opacity }]} numberOfLines={1}>
            {tip}
          </Animated.Text>
          <Icon name="sparkle" size={16} color={colors.flame} />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

/* ---------- Quick actions ---------- */

export type QuickAction = { key: string; icon: IconName; label: string; onPress: () => void; tone?: 'flame' | 'plain'; badge?: number };

export function QuickActions({ title, actions, viewAll, onViewAll }: { title: string; actions: QuickAction[]; viewAll?: string; onViewAll?: () => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Section title={title} action={viewAll} onAction={onViewAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow} style={styles.bleed}>
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
            <View style={[styles.actionCircle, action.tone === 'flame' && styles.actionCircleFlame]}>
              <Icon name={action.icon} size={24} color={action.tone === 'flame' ? '#ffffff' : colors.flame} strokeWidth={1.8} />
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
      </ScrollView>
    </View>
  );
}

/* ---------- Actions required ---------- */

export function ActionsCard({
  tone,
  count,
  kicker,
  title,
  detail,
  onPress,
  hint,
}: {
  tone: 'alert' | 'calm';
  count?: number;
  kicker: string;
  title: string;
  detail?: string;
  onPress: () => void;
  hint: string;
}) {
  const alert = tone === 'alert';
  return (
    <View style={styles.actionsWrap}>
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
        <View style={{ flex: 1, minWidth: 0, gap: 4, paddingLeft: alert ? 40 : 0 }}>
          <Text style={[styles.actionsKicker, !alert && { color: '#963b14' }]} numberOfLines={1}>
            {kicker}
          </Text>
          <Text style={[styles.actionsTitle, !alert && { color: colors.ink }]} numberOfLines={2}>
            {title}
          </Text>
          {detail ? (
            <Text style={[styles.actionsDetail, !alert && { color: colors.text }]} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View style={styles.forward}>
          <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.2} />
        </View>
      </PressableScale>
      {alert ? (
        <View style={styles.alertBadge} pointerEvents="none">
          <Icon name="alert" size={22} color="#ffffff" strokeWidth={2.2} />
          {count ? <Text style={styles.alertCount}>{count}</Text> : null}
        </View>
      ) : null}
    </View>
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

  bandWrap: { marginHorizontal: -space.page },
  hero: {
    minHeight: 244,
    paddingHorizontal: space.page,
    paddingTop: space.md,
    paddingBottom: 52,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#221b16',
  },
  heroAccent: { position: 'absolute', top: -120, right: -90, width: 280, height: 280, borderRadius: 140, backgroundColor: '#42291a' },
  heroPhoto: { position: 'absolute', right: -8, bottom: -8, width: '47%', maxWidth: 250, aspectRatio: 1, borderRadius: 150, backgroundColor: '#42291a' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bell: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#bca28c', alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: colors.flame,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontFamily: fonts.semibold, fontSize: 9, color: '#ffffff' },
  avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#bca28c', alignItems: 'center', justifyContent: 'center' },
  copy: { width: '55%', marginTop: 24, gap: 3 },
  greeting: { fontFamily: fonts.medium, fontSize: 16, color: '#e8ddd3' },
  name: { fontFamily: fonts.semibold, fontSize: 36, lineHeight: 42, letterSpacing: -0.9, color: '#ffffff' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bca28c',
  },
  date: { fontFamily: fonts.medium, fontSize: 12, color: '#ffffff', flexShrink: 1 },
  scope: { fontFamily: fonts.regular, fontSize: 13, color: '#e8ddd3' },
  searchWrap: {
    marginHorizontal: space.page,
    marginTop: -27,
    borderRadius: radius.pill,
    boxShadow: '0 5px 0 rgba(234,88,12,0.22), 0 9px 18px rgba(48,25,12,0.13)',
  },
  searchRing: { padding: 1, borderRadius: radius.pill },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 53,
    paddingLeft: 6,
    paddingRight: 15,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.page,
  },
  searchLens: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text },

  actionsRow: { paddingHorizontal: space.page, gap: 14, paddingVertical: 4 },
  action: { width: 76, alignItems: 'center', gap: 8 },
  actionCircle: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  actionCircleFlame: { backgroundColor: colors.flame },
  actionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.page,
  },
  actionBadgeText: { fontFamily: fonts.semibold, fontSize: 10, color: '#ffffff' },
  actionLabel: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 14, color: colors.ink, textAlign: 'center' },

  actionsWrap: { paddingTop: 10, paddingLeft: 10 },
  actionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    paddingLeft: space.lg,
    borderRadius: 24,
    backgroundColor: colors.flameSoft,
    overflow: 'hidden',
    minHeight: 96,
  },
  actionsCardCalm: { backgroundColor: colors.surface },
  actionsKicker: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.text },
  actionsTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, color: colors.ink },
  actionsDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  forward: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center' },
  alertBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.page,
  },
  alertCount: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 20,
    textAlign: 'center',
    overflow: 'hidden',
  },

  pulse: { borderRadius: 24, padding: space.lg, gap: space.md, backgroundColor: colors.page, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  pulseTitle: { ...type.micro, textTransform: 'uppercase' },
  pulseHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  pulseValue: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  pulseCaption: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  delta: { fontFamily: fonts.medium, fontSize: 13 },
  pulseControls: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pulseMetrics: { flexDirection: 'row', marginTop: 2, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  pulseMetric: { flex: 1, paddingHorizontal: 6 },
  pulseMetricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairlineStrong },
  pulseMetricValue: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'] },
  pulseMetricLabel: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.muted, marginTop: 1 },

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
