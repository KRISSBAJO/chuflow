import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import { api } from './api';

const TOKEN_KEY = 'chuflow.pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushStatus = 'unsupported' | 'expo-go' | 'denied' | 'off' | 'on';

function inExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Why push can't work here, or null when it can. */
export function pushBlocker(): PushStatus | null {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  // Expo Go can't receive remote notifications on Android; a ChuFlow build can.
  if (inExpoGo() && Platform.OS === 'android') return 'expo-go';
  return null;
}

export async function pushStatus(): Promise<PushStatus> {
  const blocker = pushBlocker();
  if (blocker) return blocker;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  return status === 'granted' && (await AsyncStorage.getItem(TOKEN_KEY)) ? 'on' : 'off';
}

/**
 * Asks for permission when `prompt` is true (only from a tap), then links this phone's push
 * token to the signed-in user. Without `prompt` it only refreshes an existing grant.
 */
export async function enablePush(prompt: boolean): Promise<PushStatus> {
  const blocker = pushBlocker();
  if (blocker) return blocker;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ChuFlow alerts',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#ea580c',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && prompt) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return status === 'denied' ? 'denied' : 'off';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api.post('/push/expo-tokens', { token });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return 'on';
}

/** Unlinks this phone from the signed-in user (sign-out, or turning alerts off). */
export async function disablePush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete('/push/expo-tokens', { token });
  } finally {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** Alerts carry website paths; send each to the matching screen in the app. */
export function routeForAlert(url?: unknown): Href {
  const path = typeof url === 'string' ? url : '';
  const guest = path.match(/^\/guests\/([a-f0-9]{24})/);
  if (guest) return `/guest/${guest[1]}`;
  if (path.startsWith('/guests')) return '/guests';
  if (path.startsWith('/follow-up')) return '/follow-up';
  if (path.startsWith('/approvals')) return '/approvals';
  if (path.startsWith('/attendance')) return '/attendance';
  return '/';
}
