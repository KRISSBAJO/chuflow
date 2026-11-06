import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { colors, fonts } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

/*
 * The tab bar follows the website's phone tabs: Home, Guests, Follow-up, Attendance, More, each
 * shown only to roles that can use it. Children's ministry staff get Home (their Kids board),
 * Kids and More instead.
 */

function tabIcon(name: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View style={styles.iconWrap}>
        {focused ? <View style={styles.indicator} /> : null}
        <Icon name={name} size={21} color={color} strokeWidth={focused ? 2 : 1.7} />
      </View>
    );
  }
  return TabIcon;
}

function badge(count?: number) {
  return count ? (count > 99 ? '99+' : count) : undefined;
}

export default function TabsLayout() {
  const { user } = useSession();
  const { summary } = useAlerts();
  const t = useT('common.tabs');
  const role = user?.role;
  const kidsOnly = can.kidsOnly(role);
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13, marginTop: 2 },
        tabBarIconStyle: { height: 24 },
        tabBarItemStyle: { paddingVertical: 3 },
        tabBarStyle: { backgroundColor: colors.page, borderTopColor: colors.hairline, height: 58 + bottom, paddingTop: 4, paddingBottom: bottom, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarBadgeStyle: { backgroundColor: colors.flame, fontFamily: fonts.semibold, fontSize: 9.5, minWidth: 16, height: 16, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="guests" options={{ title: t('guests'), tabBarIcon: tabIcon('guests'), href: can.guests(role) ? undefined : null }} />
      <Tabs.Screen
        name="follow-up"
        options={{
          title: t('followUp'),
          tabBarIcon: tabIcon('care'),
          tabBarBadge: badge(summary?.quickStats.pendingFollowUp),
          href: can.followUp(role) ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: t('attendance'), tabBarIcon: tabIcon('attendance'), href: can.attendance(role) ? undefined : null }}
      />
      <Tabs.Screen name="kids" options={{ title: t('kids'), tabBarIcon: tabIcon('smile'), href: kidsOnly ? undefined : null }} />
      <Tabs.Screen
        name="more"
        options={{ title: t('more'), tabBarIcon: tabIcon('more'), tabBarBadge: badge(summary?.quickStats.pendingApprovals) }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 40, height: 22 },
  indicator: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 2,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.flame,
  },
});
