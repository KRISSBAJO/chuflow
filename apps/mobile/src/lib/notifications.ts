import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import { translate } from '@/i18n/provider';
import { api, getApiSession, request } from './api';

const TOKEN_KEY = 'chuflow.pushToken';
let linking: Promise<PushStatus> | null = null;

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
export function enablePush(prompt: boolean): Promise<PushStatus> {
  if (linking) return linking;
  linking = linkPush(prompt).finally(() => { linking = null; });
  return linking;
}

async function linkPush(prompt: boolean): Promise<PushStatus> {
  const session = getApiSession();
  const blocker = pushBlocker();
  if (blocker) return blocker;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: translate('more.push.channel'),
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
  if (session !== getApiSession()) return 'off';
  await request('POST', '/push/expo-tokens', { token }, session);
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return 'on';
}

/** Unlinks this phone from the signed-in user (sign-out, or turning alerts off). */
export async function disablePush(requireSuccess = false) {
  await linking?.catch(() => undefined);
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete('/push/expo-tokens', { token });
  } catch (error) {
    if (requireSuccess) throw error;
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Alerts carry website paths; send each to the matching screen in the app. */
export function routeForAlert(url?: unknown): Href {
  const path = typeof url === 'string' ? url : '';
  const guest = path.match(/^\/guests\/([a-f0-9]{24})/);
  if (guest) return `/guest/${guest[1]}`;
  const [pathname, search] = path.split('?');
  if (pathname === '/care') {
    const view = new URLSearchParams(search).get('view');
    return view === 'overdue' || view === 'unassigned'
      ? { pathname: '/care-cases', params: { view } }
      : '/care-cases';
  }
  if (path.startsWith('/guests')) return '/guests';
  if (path.startsWith('/follow-up')) return '/follow-up';
  if (path.startsWith('/approvals')) return '/approvals';
  if (path.startsWith('/attendance')) return '/attendance';
  if (pathname === '/dashboard') return '/';
  if (pathname === '/meetings') return '/meetings';
  return '/more';
}
