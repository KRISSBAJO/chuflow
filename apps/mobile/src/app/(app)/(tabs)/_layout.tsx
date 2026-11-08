import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '@/components/bottom-navigation';
import { useT } from '@/i18n/provider';
import { usePlan } from '@/lib/entitlements';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { colors } from '@/constants/theme';
export default function TabsLayout() {
  const { user } = useSession();
  const t = useT('common.tabs');
  const role = user?.role;
  const plan = usePlan();
  return (
    <Tabs tabBar={(props) => <BottomNavigation {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }}>
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="guests" options={{ title: t('guests'), href: can.guests(role) && plan.allows('guests') ? undefined : null }} />
      <Tabs.Screen name="follow-up" options={{ title: t('followUp'), href: can.followUp(role) && plan.allows('follow_up') ? undefined : null }} />
      <Tabs.Screen name="attendance" options={{ title: t('attendance'), href: can.attendance(role) && plan.allows('attendance') ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: t('more') }} />
    </Tabs>
  );
}
