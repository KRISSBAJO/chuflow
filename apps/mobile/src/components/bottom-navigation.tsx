import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icon';
import { Sheet } from './kit';
import { Caption, ListRow, tap } from './ui';
import { colors, fonts, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { useAppFormat } from '@/i18n/format';
import { useAlerts } from '@/lib/alerts';
import { usePlan } from '@/lib/entitlements';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

const ICONS: Record<string, IconName> = { index: 'home', guests: 'guests', attendance: 'attendance', more: 'more' };

/** Five clear destinations; the raised centre control opens actions without switching tabs. */
export function BottomNavigation({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { user } = useSession();
  const { summary } = useAlerts();
  const t = useT('more.quickActions');
  const tabs = useT('common.tabs');
  const format = useAppFormat();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const role = user?.role;
  const { allows } = usePlan();
  const visible = ['index', ...(can.guests(role) && allows('guests') ? ['guests'] : []), ...(can.attendance(role) && allows('attendance') ? ['attendance'] : []), 'more'];
  const routes = visible.flatMap((name) => state.routes.filter((route) => route.name === name));
  const split = Math.ceil(routes.length / 2);
  const count = (summary?.quickStats.pendingApprovals ?? 0) + (can.followUp(role) && allows('follow_up') ? (summary?.quickStats.pendingFollowUp ?? 0) : 0);
  const actions = [
    { key: 'newGuest', icon: 'guests', href: '/guest/new', show: can.guests(role) && allows('guests') },
    { key: 'newMember', icon: 'members', href: '/members/new', show: can.members(role) && allows('members') },
    { key: 'attendance', icon: 'attendance', href: '/attendance/new', show: can.recordAttendance(role) && allows('attendance') },
    { key: 'meeting', icon: 'calendar', href: '/meetings/new', show: can.lead(role) && allows('meetings') },
    { key: 'offering', icon: 'finance', href: '/finance/offerings/new', show: can.recordOfferings(role) && allows('finance') },
    { key: 'expense', icon: 'cash', href: '/finance/expenses/new', show: can.recordExpenses(role) && allows('finance') },
    { key: 'kids', icon: 'smile', href: '/kids', show: can.kids(role) && allows('kids') },
    { key: 'report', icon: 'reports', href: '/weekly-reports/new', show: can.reports(role) && allows('reporting') },
  ].filter((action) => action.show);

  function destination(route: (typeof state.routes)[number]) {
    const actualFocused = state.routes[state.index].key === route.key;
    const focused = actualFocused || (route.name === 'more' && !visible.includes(state.routes[state.index].name));
    const options = descriptors[route.key].options;
    const label = options.title ?? route.name;
    const badge = route.name === 'more' ? count : 0;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${label}, ${format.number(badge)}` : label}
        onPress={() => {
          tap();
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!actualFocused && !event.defaultPrevented) navigateToTab(route.key);
        }}
        onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
        style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
      >
        <View style={[styles.icon, focused && styles.selected]}>
          <Icon name={ICONS[route.name]} size={24} color={focused ? '#a83e0a' : '#5f5c55'} strokeWidth={focused ? 2.1 : 1.8} />
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : format.number(badge)}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, focused && styles.activeLabel]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {routes.slice(0, split).map(destination)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('title')}
          accessibilityState={{ expanded: open, disabled: !actions.length }}
          disabled={!actions.length}
          onPress={() => {
            tap();
            setOpen(true);
          }}
          style={({ pressed }) => [styles.centre, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={styles.ring}>
            <View style={styles.circle}>
              <Icon name="plus" size={29} color="#ffffff" strokeWidth={2.2} />
            </View>
          </View>
          <Text style={styles.newLabel}>{tabs('new')}</Text>
        </Pressable>
        {routes.slice(split).map(destination)}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('title')}>
        <ScrollView contentContainerStyle={{ paddingBottom: space.md }}>
          <Caption>{t('hint')}</Caption>
          {actions.map((action, index) => (
            <ListRow
              key={action.key}
              title={t(action.key)}
              divider={index > 0}
              left={<Icon name={action.icon as IconName} size={21} color={colors.ink} />}
              onPress={() => {
                setOpen(false);
                router.push(action.href as Href);
              }}
            />
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.page,
    borderTopWidth: 1,
    borderTopColor: '#e7e4dd',
    boxShadow: '0 -3px 16px rgba(17,17,17,0.045)',
  },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', minHeight: 56, gap: 3, paddingHorizontal: 2 },
  icon: { width: 44, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  selected: { backgroundColor: colors.flameSoft },
  label: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 16, color: '#5f5c55' },
  activeLabel: { fontFamily: fonts.semibold, color: colors.ink },
  centre: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', height: 76, marginTop: -20, gap: 1 },
  ring: { width: 66, height: 66, padding: 5, borderRadius: 33, backgroundColor: colors.page },
  circle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.flame, alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 12px rgba(234,88,12,0.22)' },
  newLabel: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 16, color: colors.ink },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#b9470a',
    borderWidth: 1.5,
    borderColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 13, color: '#fff' },
});
