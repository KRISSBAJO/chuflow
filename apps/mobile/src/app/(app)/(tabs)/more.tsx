import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { canUseAppLock, isAppLockEnabled, setAppLock } from '@/components/app-lock';
import { Icon, type IconName } from '@/components/icon';
import { SwitchRow } from '@/components/kit';
import { LanguageRow } from '@/components/language-picker';
import { toast } from '@/components/toast';
import { Avatar, Badge, Caption, ListRow, Screen, ScreenHeader, Section, tap } from '@/components/ui';
import { AppMark } from '@/components/wordmark';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { getWorkspaceWebUrl, api, errorMessage } from '@/lib/api';
import { disablePush, enablePush, pushStatus, type PushStatus } from '@/lib/notifications';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

/*
 * The hub of the app: the website's navigation groups at a phone's scale. Areas the person's
 * role can use open in the app; the admin-only screens open on the website.
 */

type AreaKey = 'members' | 'kids' | 'finance' | 'meetings' | 'careCases' | 'attendanceHistory' | 'reports';

/** Areas listed under the search; search itself sits at the top as a field. */
const AREAS: { key: AreaKey; icon: IconName; href: Href; show: (role?: string) => boolean }[] = [
  { key: 'members', icon: 'members', href: '/members' as Href, show: can.members },
  { key: 'kids', icon: 'smile', href: '/kids' as Href, show: (role) => can.kids(role) && !can.kidsOnly(role) },
  { key: 'finance', icon: 'finance', href: '/finance' as Href, show: can.finance },
  { key: 'meetings', icon: 'calendar', href: '/meetings' as Href, show: can.meetings },
  { key: 'careCases', icon: 'care', href: '/care-cases' as Href, show: can.careCases },
  { key: 'attendanceHistory', icon: 'history', href: '/attendance-history' as Href, show: can.attendance },
  { key: 'reports', icon: 'reports', href: '/reports' as Href, show: can.reports },
];

type LinkKey = 'branches' | 'users' | 'templates' | 'structure' | 'settings';

/** Website-only screens, gated like apps/web/src/lib/permissions.ts. */
const WEB_LINKS: { key: LinkKey; icon: IconName; path: string; show: (role?: string) => boolean }[] = [
  { key: 'branches', icon: 'building', path: '/branches', show: can.lead },
  { key: 'users', icon: 'user', path: '/users', show: can.lead },
  { key: 'templates', icon: 'clipboard', path: '/templates', show: can.lead },
  { key: 'structure', icon: 'grid', path: '/hierarchy', show: can.lead },
  { key: 'settings', icon: 'settings', path: '/settings', show: can.dashboard },
];

function RowIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={18} color={colors.muted} />;
}

/** Soft square behind an area's icon, so the list of areas reads heavier than the settings rows. */
function AreaIcon({ name }: { name: IconName }) {
  return (
    <View style={styles.areaIcon}>
      <Icon name={name} size={18} color={colors.ink} />
    </View>
  );
}

/** Looks like the search field; tapping it opens the search screen with the keyboard up. */
function SearchLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.searchLink, pressed && { backgroundColor: colors.surfaceStrong }]}
    >
      <View style={styles.searchIcon}>
        <Icon name="search" size={15} color="#ffffff" strokeWidth={2.2} />
      </View>
      <Text style={styles.searchText} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="arrowRight" size={15} color={colors.faint} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { user, signOut, workspaces, showWorkspacePicker } = useSession();
  const workspaceText = useT('auth.workspacePicker');
  const { isUpdatePending } = Updates.useUpdates();
  const { summary } = useAlerts();
  const t = useT('more');
  const common = useT('common');
  const format = useAppFormat();
  const [push, setPush] = useState<PushStatus | null>(null);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = user?.role;

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

  function confirmSignOut() {
    const run = () => void signOut();
    if (Platform.OS === 'web') {
      if (window.confirm(t('signOutConfirm'))) run();
      return;
    }
    Alert.alert(t('signOutTitle'), t('signOutBody'), [
      { text: common('actions.cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: run },
    ]);
  }

  const pending = summary?.quickStats.pendingApprovals ?? 0;
  const areas = AREAS.filter((area) => area.show(role));
  const links = WEB_LINKS.filter((link) => link.show(role));
  const pushKey = push === 'expo-go' ? 'expoGo' : push;

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <ScreenHeader title={common('tabs.more')} />

      {can.search(role) ? <SearchLink label={t('hints.search')} onPress={() => router.push('/search' as Href)} /> : null}

      <View style={styles.profile}>
        <Avatar person={user} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.title} numberOfLines={1}>
            {format.fullName(user)}
          </Text>
          <Caption numberOfLines={1}>{user?.email}</Caption>
        </View>
        <Badge label={format.role(role)} tone="flame" />
      </View>

      {can.followUp(role) ? (
        <ListRow
          title={common('tabs.followUp')}
          left={<RowIcon name="care" />}
          right={summary?.quickStats.pendingFollowUp ? <Badge label={format.number(summary.quickStats.pendingFollowUp)} tone="flame" /> : undefined}
          onPress={() => router.push('/follow-up')}
        />
      ) : null}
      {can.approvals(role) ? (
        <ListRow
          title={common('areas.approvals')}
          subtitle={pending ? t('approvalsWaiting', { count: pending }) : t('nothingWaiting')}
          left={<RowIcon name="approvals" />}
          right={pending ? <Badge label={format.number(pending)} tone="flame" /> : undefined}
          onPress={() => router.push('/approvals')}
        />
      ) : null}

      {workspaces.length > 1 ? (
        <ListRow title={workspaceText('title')} subtitle={user?.workspace?.name} onPress={showWorkspacePicker} />
      ) : null}

      {areas.length ? (
        <View>
          <Section title={t('workspace')} />
          {areas.map((area, index) => (
            <ListRow
              key={area.key}
              divider={index > 0}
              title={common(`areas.${area.key}`)}
              subtitle={t(`hints.${area.key}`)}
              left={<AreaIcon name={area.icon} />}
              onPress={() => router.push(area.href)}
            />
          ))}
        </View>
      ) : null}

      <View>
        <Section title={t('thisPhone')} />
        <SwitchRow
          icon="bell"
          title={t('alerts')}
          body={pushKey ? t(`push.${pushKey}`) : common('state.checking')}
          value={push === 'on'}
          disabled={busy || !push || ['unsupported', 'expo-go'].includes(push)}
          onChange={(value) => void togglePush(value)}
        />
        {push === 'on' ? <ListRow divider title={t('testAlert')} left={<RowIcon name="sparkle" />} onPress={() => void sendTest()} /> : null}
        {lockAvailable ? <SwitchRow divider icon="lock" title={t('appLock')} body={t('appLockHint')} value={lockOn} onChange={(value) => void toggleLock(value)} /> : null}
        <LanguageRow divider />
      </View>

      {links.length ? (
        <View>
          <Section title={t('website')} />
          {links.map((link, index) => (
            <ListRow
              key={link.key}
              divider={index > 0}
              title={link.key === 'settings' ? common('areas.settings') : t(`links.${link.key}`)}
              left={<RowIcon name={link.icon} />}
              right={<Icon name="arrowUpRight" size={14} color={colors.faint} />}
              chevron={false}
              onPress={() => void WebBrowser.openBrowserAsync(`${getWorkspaceWebUrl()}${link.path}`)}
            />
          ))}
        </View>
      ) : null}

      <ListRow
        title={t('updates.title')}
        subtitle={isUpdatePending ? t('updates.updateReady') : t('updates.hint')}
        left={<RowIcon name="refresh" />}
        right={isUpdatePending ? <Badge label={t('updates.updateReady')} tone="flame" /> : undefined}
        onPress={() => router.push('/app-updates' as Href)}
      />
      <ListRow title={t('signOut')} left={<Icon name="logout" size={18} color={colors.danger} />} chevron={false} onPress={confirmSignOut} />

      <View style={styles.footer}>
        <AppMark size={22} />
        <Text style={styles.footerText}>
          {common('appName')} · {common('tagline')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  areaIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 50,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  searchIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  searchText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  footer: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  footerText: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.faint },
});
