import { router, Stack } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { AppLockGate } from '@/components/app-lock';
import { PlanGate } from '@/components/plan-banner';
import { toast } from '@/components/toast';
import { colors, fonts } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { AlertsProvider } from '@/lib/alerts';
import { disablePush, enablePush } from '@/lib/notifications';
import { useOutboxSync } from '@/lib/offline-queue';
import { onBeforeSignOut, useSession } from '@/lib/session';
import { useAlertTaps } from '@/lib/use-alert-taps';

/*
 * Every signed-in screen sits in this stack. Screens set their own translated title with
 * `<Stack.Screen options={{ title }} />`; modal screens are listed here so they slide up.
 */

export function CancelButton() {
  const t = useT('common.actions');
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ paddingHorizontal: Platform.OS === 'web' ? 16 : 0 }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.muted }}>{t('cancel')}</Text>
    </Pressable>
  );
}

const MODALS = ['guest/new', 'attendance/new', 'care/[id]', 'members/new', 'members/convert', 'finance/offerings/new', 'finance/expenses/new', 'meetings/new', 'kids/sessions/new', 'kids/scan', 'search'];

export default function SignedInLayout() {
  const { user } = useSession();
  const t = useT('common');

  // Re-link this phone's alerts to whoever is signed in; unlink on sign-out.
  useEffect(() => {
    void enablePush(false).catch(() => undefined);
    return onBeforeSignOut(() => disablePush().catch(() => undefined));
  }, []);

  useAlertTaps();

  useOutboxSync(
    useCallback(
      (count: number) => {
        toast.success(t('outboxSent', { count }));
      },
      [t],
    ),
  );

  return (
    <AppLockGate>
      <AlertsProvider days={user?.preferences?.defaultReportDays ?? 30}>
        <PlanGate>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.page },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.page },
            title: '',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {MODALS.map((name) => (
            <Stack.Screen key={name} name={name} options={{ presentation: 'modal', headerLeft: () => <CancelButton /> }} />
          ))}
        </Stack>
        </PlanGate>
      </AlertsProvider>
    </AppLockGate>
  );
}
