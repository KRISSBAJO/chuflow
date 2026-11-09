import * as Updates from 'expo-updates';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Badge, Button, Caption, ListRow, Screen, ScreenHeader, Section } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { usePlan } from '@/lib/entitlements';
import { branchName } from '@/lib/format';
import { openWorkspaceBrowser } from '@/lib/open-workspace-browser';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary, FeatureKey } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { AppPreferences } from './app-preferences';

type AreaKey = 'members' | 'kids' | 'finance' | 'meetings' | 'careCases' | 'attendanceHistory' | 'reports';
type MoreSection = 'account' | 'tools' | 'admin' | 'preferences';

function openSection(section: MoreSection) {
  router.push(('/more/' + section) as Href);
}
const AREAS: { key: AreaKey; icon: IconName; href: Href; feature: FeatureKey; show: (role?: string) => boolean }[] = [
  { key: 'members', icon: 'members', href: '/members', feature: 'members', show: can.members },
  { key: 'kids', icon: 'smile', href: '/kids', feature: 'kids', show: (role) => can.kids(role) && !can.kidsOnly(role) },
  { key: 'finance', icon: 'finance', href: '/finance', feature: 'finance', show: can.finance },
  { key: 'meetings', icon: 'calendar', href: '/meetings', feature: 'meetings', show: can.meetings },
  { key: 'careCases', icon: 'care', href: '/care-cases', feature: 'care', show: can.careCases },
  { key: 'attendanceHistory', icon: 'history', href: '/attendance-history', feature: 'attendance', show: can.attendance },
  { key: 'reports', icon: 'reports', href: '/reports', feature: 'reporting', show: can.reports },
];
type LinkKey = 'branches' | 'users' | 'templates' | 'structure' | 'settings' | 'outreach' | 'serviceUnits' | 'registerFamily' | 'forms';
type WebLink = { key: LinkKey; icon: IconName; path: string; show: (role?: string) => boolean; feature?: FeatureKey };
const MINISTRY_LINKS: WebLink[] = [
  { key: 'outreach', icon: 'members', path: '/evangelism', show: can.guests },
  { key: 'serviceUnits', icon: 'grid', path: '/service-units', show: can.lead },
  { key: 'registerFamily', icon: 'user', path: '/children/families/new', show: can.kidsSupervise, feature: 'kids' },
];
const ADMIN_LINKS: WebLink[] = [
  { key: 'branches', icon: 'building', path: '/branches', show: can.lead },
  { key: 'users', icon: 'user', path: '/users', show: can.lead },
  { key: 'templates', icon: 'clipboard', path: '/templates', show: can.lead },
  { key: 'structure', icon: 'grid', path: '/hierarchy', show: can.lead },
  { key: 'forms', icon: 'clipboard', path: '/settings#settings-forms', show: (role) => role === 'super_admin' },
  { key: 'forms', icon: 'clipboard', path: '/settings/branch-guest-forms', show: (role) => role === 'branch_admin' || role === 'resident_pastor' },
  { key: 'settings', icon: 'settings', path: '/settings', show: can.dashboard },
];

function RowIcon({ name }: { name: IconName }) {
  return <View style={styles.icon}><Icon name={name} size={18} color={colors.ink} /></View>;
}

function AccountCard({ details = false }: { details?: boolean }) {
  const { user, workspaces, showWorkspacePicker } = useSession();
  const t = useT('more.menu');
  const format = useAppFormat();
  const branchId = userBranchId(user);
  const populated = branchName(user?.branchId);
  const lookup = Boolean(branchId && !populated);
  const kidsOnly = can.kidsOnly(user?.role);
  const branches = useApi<BranchSummary[]>(lookup && !kidsOnly ? '/branches/options' : null);
  const kids = useApi<{ branches: { _id: string; name: string }[] }>(lookup && kidsOnly ? `/children?branchId=${encodeURIComponent(branchId)}` : null);
  const branch = populated || (kidsOnly ? kids.data?.branches : branches.data)?.find(({ _id }) => _id === branchId)?.name;
  return (
    <View style={styles.account}>
      <View style={styles.profile}>
        <Avatar person={user} size={46} />
        <View style={styles.identity}>
          <Text style={type.title}>{format.fullName(user)}</Text>
          {user?.role ? <Caption>{format.role(user.role)}</Caption> : null}
          {details && user?.email ? <Caption>{user.email}</Caption> : null}
        </View>
      </View>
      <View style={styles.scope}>
        <Icon name="building" size={18} color={colors.warning} />
        <View style={styles.identity}>
          <Text style={type.label}>{user?.workspace?.name || t('workspaceFallback')}</Text>
          {branch ? <Caption>{branch}</Caption> : null}
        </View>
      </View>
      {!details ? <ListRow title={t('account')} divider onPress={() => openSection('account')} /> : null}
      {workspaces.length > 1 ? <ListRow title={t('switchWorkspace')} divider onPress={showWorkspacePicker} /> : null}
    </View>
  );
}

function AreaRows({ areas }: { areas: typeof AREAS }) {
  const common = useT('common');
  const t = useT('more');
  const { allows } = usePlan();
  return <>{areas.map((area, index) => {
    const locked = !allows(area.feature);
    return (
      <ListRow key={area.key} divider={index > 0} title={common(`areas.${area.key}`)}
        subtitle={locked ? common('plan.notInPlan') : t(`hints.${area.key}`)}
        left={<RowIcon name={locked ? 'lock' : area.icon} />}
        right={locked ? <Badge label={common('plan.lockedBadge')} /> : undefined}
        onPress={locked ? undefined : () => router.push(area.href)} />
    );
  })}</>;
}

function WebsiteRows({ links }: { links: WebLink[] }) {
  const { user } = useSession();
  const t = useT('more');
  const tc = useT('common');
  if (!links.length) return null;
  return (
    <View>
      <Section title={t('website')} />
      {links.map((link, index) => (
        <ListRow key={link.key} divider={index > 0} title={link.key === 'settings' ? tc('areas.settings') : t(`links.${link.key}`)}
          left={<RowIcon name={link.icon} />} chevron={false} right={<Icon name="arrowUpRight" size={15} color={colors.muted} />}
          onPress={() => void openWorkspaceBrowser(link.path, user?.workspace)} />
      ))}
    </View>
  );
}

function useMoreLinks() {
  const { user } = useSession();
  const { allows } = usePlan();
  const role = user?.role;
  return {
    primary: AREAS.slice(0, 4).filter((area) => area.show(role)),
    secondary: AREAS.slice(4).filter((area) => area.show(role)),
    ministry: MINISTRY_LINKS.filter((link) => link.show(role) && (!link.feature || allows(link.feature))),
    admin: ADMIN_LINKS.filter((link) => link.show(role)),
    followUp: can.followUp(role) && allows('follow_up'),
    approvals: can.approvals(role),
  };
}

export function MoreScreen() {
  const t = useT('more');
  const tc = useT('common');
  const format = useAppFormat();
  const { summary } = useAlerts();
  const { isUpdatePending } = Updates.useUpdates();
  const { primary, secondary, ministry, admin, followUp, approvals } = useMoreLinks();
  const followUpCount = followUp ? summary?.quickStats.pendingFollowUp ?? 0 : 0;
  const approvalCount = approvals ? summary?.quickStats.pendingApprovals ?? 0 : 0;
  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <ScreenHeader title={tc('tabs.more')} />
      <AccountCard />
      {followUpCount || approvalCount ? (
        <View>
          <Section title={t('menu.attention')} />
          {followUpCount ? <ListRow title={tc('tabs.followUp')} left={<RowIcon name="care" />}
            right={<Badge label={format.number(followUpCount)} tone="flame" />} onPress={() => router.push('/follow-up')} /> : null}
          {approvalCount ? <ListRow title={tc('areas.approvals')} divider={followUpCount > 0} left={<RowIcon name="approvals" />}
            right={<Badge label={format.number(approvalCount)} tone="flame" />} onPress={() => router.push('/approvals')} /> : null}
        </View>
      ) : null}
      {primary.length || secondary.length || ministry.length || followUp || approvals ? (
        <View>
          <Section title={t('menu.ministry')} />
          <AreaRows areas={primary} />
          {secondary.length || ministry.length || followUp || approvals ? <ListRow title={t('menu.tools')} divider={primary.length > 0}
            left={<RowIcon name="grid" />} onPress={() => openSection('tools')} /> : null}
        </View>
      ) : null}
      <View>
        <Section title={t('menu.manage')} />
        {admin.length ? <ListRow title={t('menu.admin')} left={<RowIcon name="building" />} onPress={() => openSection('admin')} /> : null}
        <ListRow title={t('menu.preferences')} divider={admin.length > 0} left={<RowIcon name="settings" />} onPress={() => openSection('preferences')} />
        <ListRow title={t('updates.title')} divider left={<RowIcon name="refresh" />}
          right={isUpdatePending ? <Badge label={t('updates.updateReady')} tone="flame" /> : undefined} onPress={() => router.push('/app-updates')} />
      </View>
    </Screen>
  );
}

function AccountPage() {
  const { signOut } = useSession();
  const t = useT('more');
  const tc = useT('common');
  function confirm() {
    if (Platform.OS === 'web') {
      if (window.confirm(t('signOutConfirm'))) void signOut();
      return;
    }
    Alert.alert(t('signOutTitle'), t('signOutBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  }
  return (
    <>
      <AccountCard details />
      <ListRow title={t('signOut')} left={<Icon name="logout" size={18} color={colors.danger} />} chevron={false} onPress={confirm} />
    </>
  );
}

export function MoreSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const t = useT('more');
  const tc = useT('common');
  const { secondary, ministry, admin, followUp, approvals } = useMoreLinks();
  const titles = { account: t('menu.account'), tools: t('menu.tools'), admin: t('menu.admin'), preferences: t('menu.preferences') };
  const title = Object.hasOwn(titles, section) ? titles[section as keyof typeof titles] : tc('tabs.more');
  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={t('menu.back')} icon="chevronLeft" size="sm" variant="secondary" onPress={() => router.dismissTo('/more')} />
      </View>
      <ScreenHeader title={title} />
      {section === 'account' ? <AccountPage /> : null}
      {section === 'preferences' ? <AppPreferences /> : null}
      {section === 'admin' ? <WebsiteRows links={admin} /> : null}
      {section === 'tools' ? (
        <>
          <View>
            {followUp ? <ListRow title={tc('tabs.followUp')} left={<RowIcon name="care" />} onPress={() => router.push('/follow-up')} /> : null}
            {approvals ? <ListRow title={tc('areas.approvals')} divider={followUp} left={<RowIcon name="approvals" />} onPress={() => router.push('/approvals')} /> : null}
            <AreaRows areas={secondary} />
          </View>
          <WebsiteRows links={ministry} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  scope: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
