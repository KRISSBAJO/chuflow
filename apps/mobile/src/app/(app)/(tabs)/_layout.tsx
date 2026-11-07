import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '@/components/bottom-navigation';
import { useT } from '@/i18n/provider';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { colors } from '@/constants/theme';
export default function TabsLayout() {
  const { user } = useSession();
  const t = useT('common.tabs');
  const role = user?.role;
  return (
    <Tabs tabBar={(props) => <BottomNavigation {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.page } }}>
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="guests" options={{ title: t('guests'), href: can.guests(role) ? undefined : null }} />
      <Tabs.Screen name="follow-up" options={{ title: t('followUp'), href: can.followUp(role) ? undefined : null }} />
      <Tabs.Screen name="attendance" options={{ title: t('attendance'), href: can.attendance(role) ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: t('more') }} />
    </Tabs>
  );
}
