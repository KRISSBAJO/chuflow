import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { routeForAlert } from './notifications';

/** Tapping an alert opens the matching screen, including the alert that launched the app. */
export function useAlertTaps() {
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (url) router.push(routeForAlert(url));
  }, [lastResponse]);
}
