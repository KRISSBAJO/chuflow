import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { translate, useT } from '@/i18n/provider';
import { Body, Button, Title } from './ui';
import { AppMark } from './wordmark';

const LOCK_KEY = 'chuflow.appLock';
/** Coming back after this long in the background asks for Face ID / fingerprint again. */
const RELOCK_AFTER_MS = 5 * 60 * 1000;

export async function isAppLockEnabled() {
  return (await AsyncStorage.getItem(LOCK_KEY)) === 'on';
}

export async function canUseAppLock() {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/** Turns the lock on only after the person proves they can unlock it. */
export async function setAppLock(enabled: boolean) {
  if (enabled) {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: translate('more.lock.enablePrompt') });
    if (!result.success) return false;
  }
  await AsyncStorage.setItem(LOCK_KEY, enabled ? 'on' : 'off');
  return true;
}

/** Hides the signed-in app behind Face ID / fingerprint when App lock is on. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const t = useT('more.lock');
  const [locked, setLocked] = useState<boolean | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: translate('more.lock.unlockPrompt'),
      fallbackLabel: translate('more.lock.fallback'),
    });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    void isAppLockEnabled().then((enabled) => {
      setLocked(enabled);
      if (enabled) void unlock();
    });
  }, [unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) {
          void isAppLockEnabled().then((enabled) => {
            if (enabled) {
              setLocked(true);
              void unlock();
            }
          });
        }
      }
    });
    return () => subscription.remove();
  }, [unlock]);

  if (locked === null) return <View style={styles.cover} />;
  if (!locked) return <>{children}</>;

  return (
    <View style={styles.cover}>
      <AppMark size={64} />
      <Title style={styles.title}>{t('lockedTitle')}</Title>
      <Body style={styles.body}>{t('lockedBody')}</Body>
      <Button label={t('unlock')} icon="lock" size="lg" onPress={() => void unlock()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  title: { marginTop: space.xl, fontSize: 26, textAlign: 'center' },
  body: { marginTop: space.sm, textAlign: 'center', color: colors.muted },
  button: { marginTop: space.xxl, alignSelf: 'stretch' },
});
