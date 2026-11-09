import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { canUseAppLock, isAppLockEnabled, setAppLock } from '@/components/app-lock';
import { Icon } from '@/components/icon';
import { SwitchRow } from '@/components/kit';
import { LanguageRow } from '@/components/language-picker';
import { toast } from '@/components/toast';
import { ListRow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { disablePush, enablePush, pushStatus, type PushStatus } from '@/lib/notifications';

export function AppPreferences() {
  const t = useT('more');
  const common = useT('common');
  const [push, setPush] = useState<PushStatus | null>(null);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void pushStatus().then(setPush);
      void canUseAppLock().then(setLockAvailable);
      void isAppLockEnabled().then(setLockOn);
    }, []),
  );

  async function togglePush(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const status = await enablePush(true);
        setPush(status);
        if (status === 'on') toast.success(t('push.enabled'));
      } else {
        await disablePush();
        setPush('off');
      }
    } catch (error) {
      toast.error(errorMessage(error, t('push.changeFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      const { delivered } = await api.post<{ delivered: number }>('/push/test');
      if (delivered) toast.success(t('push.testSent'));
      else toast.error(t('push.testFailed'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function toggleLock(next: boolean) {
    const changed = await setAppLock(next);
    if (changed) {
      setLockOn(next);
      toast.success(next ? t('appLockOn') : t('appLockOff'));
    }
  }

  const pushKey = push === 'expo-go' ? 'expoGo' : push;
  return (
    <View>
      <SwitchRow
        icon="bell"
        title={t('alerts')}
        body={pushKey ? t(`push.${pushKey}`) : common('state.checking')}
        value={push === 'on'}
        disabled={busy || !push || ['unsupported', 'expo-go'].includes(push)}
        onChange={(value) => void togglePush(value)}
      />
      {push === 'on' ? <ListRow divider title={t('testAlert')} left={<Icon name="sparkle" size={18} color={colors.muted} />} onPress={() => void sendTest()} /> : null}
      {lockAvailable ? <SwitchRow divider icon="lock" title={t('appLock')} body={t('appLockHint')} value={lockOn} onChange={(value) => void toggleLock(value)} /> : null}
      <LanguageRow divider />
    </View>
  );
}
