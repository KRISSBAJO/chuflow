import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { canUseAppLock, isAppLockEnabled, setAppLock } from '@/components/app-lock';
import { Icon, type IconName } from '@/components/icon';
import { toast } from '@/components/toast';
import { Avatar, Badge, Caption, ListRow, Screen, ScreenHeader, Section, tap } from '@/components/ui';
import { AppMark } from '@/components/wordmark';
import { colors, fonts, space, type } from '@/constants/theme';
import { useAlerts } from '@/lib/alerts';
import { api, errorMessage } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { fullName } from '@/lib/format';
import { disablePush, enablePush, pushStatus, type PushStatus } from '@/lib/notifications';
import { can, roleLabel } from '@/lib/permissions';
import { useSession } from '@/lib/session';

const PUSH_COPY: Record<PushStatus, string> = {
  on: 'New first-timers, your follow-ups and approvals.',
  off: 'Get alerts for first-timers, follow-ups and approvals.',
  denied: 'Blocked in your phone settings. Allow notifications for ChuFlow there.',
  'expo-go': 'Alerts need the installed ChuFlow app; Expo Go on Android can’t receive them.',
  unsupported: 'This device can’t receive phone alerts.',
};

function RowIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={18} color={colors.muted} />;
}

function SettingRow({ icon, title, body, value, onChange, disabled, divider }: {
  icon: IconName;
  title: string;
  body: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
}) {
  return (
    <View style={[styles.setting, divider && styles.divider]}>
      <RowIcon name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={type.label}>{title}</Text>
        <Caption>{body}</Caption>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          tap();
          onChange(next);
        }}
        trackColor={{ true: colors.flame, false: '#dedbd4' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

export default function MoreScreen() {
  const { user, signOut } = useSession();
  const { summary } = useAlerts();
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
        if (status === 'on') toast.success('Alerts are on for this phone');
      } else {
        await disablePush();
        setPush('off');
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't change alerts."));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      const { delivered } = await api.post<{ delivered: number }>('/push/test');
      if (delivered) toast.success('Test sent. It should arrive in a few seconds.');
      else toast.error('No device received it. Turn alerts off and on again.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function toggleLock(next: boolean) {
    const changed = await setAppLock(next);
    if (changed) {
      setLockOn(next);
      toast.success(next ? 'App lock is on' : 'App lock is off');
    }
  }

  function confirmSignOut() {
    const run = () => void signOut();
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of ChuFlow?')) run();
      return;
    }
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: run },
    ]);
  }

  const pending = summary?.quickStats.pendingApprovals ?? 0;

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title="More" />

      <View style={styles.profile}>
        <Avatar person={user} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.title} numberOfLines={1}>
            {fullName(user)}
          </Text>
          <Caption numberOfLines={1}>{user?.email}</Caption>
        </View>
        <Badge label={roleLabel(user?.role)} tone="flame" />
      </View>

      {can.approvals(user?.role) ? (
        <ListRow
          title="Approvals"
          subtitle={pending ? `${pending} waiting for you` : 'Nothing waiting'}
          left={<RowIcon name="approvals" />}
          right={pending ? <Badge label={String(pending)} tone="flame" /> : undefined}
          onPress={() => router.push('/approvals')}
        />
      ) : null}

      <View>
        <Section title="This phone" />
        <SettingRow
          icon="bell"
          title="Alerts"
          body={push ? PUSH_COPY[push] : 'Checking…'}
          value={push === 'on'}
          disabled={busy || !push || ['unsupported', 'expo-go'].includes(push)}
          onChange={(value) => void togglePush(value)}
        />
        {push === 'on' ? <ListRow divider title="Send a test alert" left={<RowIcon name="sparkle" />} onPress={() => void sendTest()} /> : null}
        {lockAvailable ? (
          <SettingRow
            divider
            icon="lock"
            title="App lock"
            body="Ask for Face ID or fingerprint when opening ChuFlow."
            value={lockOn}
            onChange={(value) => void toggleLock(value)}
          />
        ) : null}
      </View>

      <View>
        <Section title="On the website" />
        {[
          { title: 'Members', path: '/members', icon: 'members' as const },
          { title: 'Finance', path: '/finance', icon: 'finance' as const },
          { title: 'Reports', path: '/reports', icon: 'reports' as const },
          { title: 'Settings', path: '/settings', icon: 'settings' as const },
        ].map((link, index) => (
          <ListRow
            key={link.path}
            divider={index > 0}
            title={link.title}
            left={<RowIcon name={link.icon} />}
            right={<Icon name="arrowUpRight" size={14} color={colors.faint} />}
            chevron={false}
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}${link.path}`)}
          />
        ))}
      </View>

      <ListRow title="Sign out" left={<Icon name="logout" size={18} color={colors.danger} />} chevron={false} onPress={confirmSignOut} />

      <View style={styles.footer}>
        <AppMark size={22} />
        <Text style={styles.footerText}>ChuFlow · From Membership to Ministry</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  setting: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  footer: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  footerText: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.faint },
});
