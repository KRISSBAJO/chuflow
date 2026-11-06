import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HomeHero } from '@/components/home-hero';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Caption, EmptyState, ErrorState, ListRow, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { routeForAlert } from '@/lib/notifications';
import { useOnline } from '@/lib/offline-queue';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { DaysRow } from './days-row';
import { BranchHealth, Watchlist } from './executive-blocks';
import { AttendanceMix, FollowUpPipeline, NewestMembers } from './operational-blocks';
import type { DashboardOverview } from './types';

/*
 * Home for everyone but children's workers: the website dashboard at a phone's scale. The hero
 * carries the four headline numbers; below it the shortcuts, what needs the user, then the
 * dashboard blocks for the chosen range.
 */

const ALERT_DOT: Record<string, string> = { critical: colors.danger, warm: colors.warning, cool: colors.info };
const DAY_OPTIONS = [7, 30, 90] as const;

type Shortcut = { key: string; label: string; icon: IconName; href: Href; show: boolean };

export function HomeScreen() {
  const { user } = useSession();
  const { summary, refresh: refreshAlerts } = useAlerts();
  const online = useOnline();
  const t = useT('home');
  const tc = useT('common');
  const format = useAppFormat();
  const role = user?.role;
  const [showAllActions, setShowAllActions] = useState(false);
  const [days, setDays] = useState(() => user?.preferences?.defaultReportDays ?? 30);
  const dashboard = useApi<DashboardOverview>(`/reports/dashboard?days=${days}`);
  const [today] = useState(() => new Date());

  const allShortcuts: Shortcut[] = [
    { key: 'newGuest', label: t('shortcuts.newGuest'), icon: 'plus', href: '/guest/new', show: can.guests(role) },
    { key: 'attendance', label: t('shortcuts.attendance'), icon: 'attendance', href: '/attendance', show: can.attendance(role) },
    { key: 'followUp', label: t('shortcuts.followUp'), icon: 'care', href: '/follow-up', show: can.followUp(role) },
    { key: 'approvals', label: t('shortcuts.approvals'), icon: 'approvals', href: '/approvals', show: can.approvals(role) },
    { key: 'members', label: t('shortcuts.members'), icon: 'members', href: '/members' as Href, show: can.members(role) },
    { key: 'kids', label: t('shortcuts.kids'), icon: 'smile', href: '/kids' as Href, show: can.kids(role) && !can.kidsOnly(role) },
    { key: 'finance', label: t('shortcuts.finance'), icon: 'finance', href: '/finance' as Href, show: can.finance(role) },
    { key: 'meetings', label: t('shortcuts.meetings'), icon: 'calendar', href: '/meetings' as Href, show: can.meetings(role) },
    { key: 'reports', label: t('shortcuts.reports'), icon: 'reports', href: '/reports' as Href, show: can.reports(role) },
  ];
  const shortcuts = allShortcuts.filter((shortcut) => shortcut.show);
  const visibleShortcuts = showAllActions ? shortcuts : shortcuts.slice(0, 6);

  const data = dashboard.data;
  const metrics = data?.metrics;
  const operational = data?.operational;
  const recent = operational?.recentGuests ?? [];
  const needsYou = summary?.items ?? [];
  const scopeLabel = data?.scope.kind === 'all_network' ? t('allNetwork') : data?.scope.label;
  const executive = can.executive(role) && data?.scope.kind !== 'branch' ? data?.executive : undefined;

  return (
    <Screen
      refreshing={dashboard.refreshing}
      onRefresh={() => {
        void dashboard.refresh();
        void refreshAlerts();
      }}
      contentStyle={{ gap: space.xl }}
    >
      <HomeHero
        dateLabel={format.longDate(today)}
        greeting={format.greeting(today)}
        name={user?.firstName || t('friend')}
        scope={[scopeLabel, tc('time.lastNDays', { count: days })].filter(Boolean).join(' · ')}
        alerts={summary?.quickStats.activeAlerts ?? 0}
        alertsLabel={t('alertsLabel', { count: summary?.quickStats.activeAlerts ?? 0 })}
        onAlerts={() => router.push(can.approvals(role) ? '/approvals' : '/more')}
        metrics={[
          {
            key: 'guests',
            label: t('metrics.guests'),
            value: !metrics ? '—' : format.number(metrics?.totalGuests),
            onPress: can.guests(role) ? () => router.push('/guests') : undefined,
          },
          {
            key: 'attendance',
            label: t('metrics.attendance'),
            value: !metrics ? '—' : format.number(metrics?.totalAttendance),
            onPress: can.attendance(role) ? () => router.push('/attendance') : undefined,
          },
          {
            key: 'members',
            label: t('metrics.members'),
            value: !metrics ? '—' : format.number(metrics?.totalMembers),
            onPress: can.members(role) ? () => router.push('/members' as Href) : undefined,
          },
          {
            key: 'followUp',
            label: t('metrics.followUp'),
            value: !metrics ? '—' : format.number(metrics?.pendingFollowUp),
            onPress: can.followUp(role) ? () => router.push('/follow-up') : undefined,
          },
        ]}
      />

      {!online ? (
        <Notice tone="warning" icon="cloudOff">
          {t('offline')}
        </Notice>
      ) : null}

      {dashboard.error && !metrics ? <ErrorState message={dashboard.error} onRetry={() => void dashboard.refresh()} /> : null}

      {shortcuts.length ? (
        <View>
          <Section
            title={t('shortcuts.title')}
            action={shortcuts.length > 6 ? t(showAllActions ? 'shortcuts.showLess' : 'shortcuts.showAll') : undefined}
            onAction={() => setShowAllActions(!showAllActions)}
          />
          <View style={styles.shortcuts}>
            {visibleShortcuts.map((shortcut, index) => (
              <Pressable
                key={shortcut.key}
                accessibilityRole="button"
                accessibilityLabel={shortcut.label}
                onPress={() => {
                  tap();
                  router.push(shortcut.href);
                }}
                style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.6 }]}
              >
                <View style={[styles.shortcutIcon, index === 0 && styles.shortcutPrimary]}>
                  <Icon name={shortcut.icon} size={18} color={index === 0 ? '#ffffff' : colors.ink} strokeWidth={index === 0 ? 2.2 : 1.8} />
                </View>
                <Text style={styles.shortcutLabel} numberOfLines={1}>
                  {shortcut.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <Section title={t('needsYou.title')} />
        {needsYou.length ? (
          needsYou
            .slice(0, 4)
            .map((item, index) => (
              <ListRow
                key={item.key}
                divider={index > 0}
                title={`${format.number(item.count)} ${item.label.toLowerCase()}`}
                subtitle={item.description}
                left={<View style={[styles.alertDot, { backgroundColor: ALERT_DOT[item.tone] ?? colors.faint }]} />}
                onPress={() => router.push(routeForAlert(item.href))}
              />
            ))
        ) : summary ? (
          <View style={styles.caughtUp}>
            <Icon name="check" size={15} color={colors.success} strokeWidth={2.2} />
            <Caption>{t('needsYou.caughtUp')}</Caption>
          </View>
        ) : (
          <Caption>{tc('state.loading')}</Caption>
        )}
      </View>

      <DaysRow title={t('overview.title')} value={days} options={DAY_OPTIONS} onChange={setDays} label={(count) => t('overview.days', { count })} />

      {executive ? (
        <>
          <Watchlist executive={executive} />
          <BranchHealth leaders={executive.topGrowthBranches} attention={executive.bottomGrowthBranches} />
        </>
      ) : null}

      {operational ? (
        <>
          <FollowUpPipeline pipeline={operational.followUpPipeline} onOpen={can.followUp(role) ? () => router.push('/follow-up') : undefined} />
          <AttendanceMix mix={operational.attendanceMix} onOpen={can.attendance(role) ? () => router.push('/attendance') : undefined} />
        </>
      ) : null}

      <View>
        <Section title={t('recentGuests.title')} action={recent.length && can.guests(role) ? tc('actions.seeAll') : undefined} onAction={() => router.push('/guests')} />
        {recent.length ? (
          recent
            .slice(0, 3)
            .map((guest, index) => (
              <ListRow
                key={guest._id}
                divider={index > 0}
                title={format.fullName(guest)}
                subtitle={guest.visitStatus ? format.status(guest.visitStatus) : undefined}
                left={<Avatar person={guest} size={30} />}
                right={<Caption>{format.relativeTime(guest.createdAt)}</Caption>}
                chevron={false}
                onPress={can.guests(role) ? () => router.push(`/guest/${guest._id}`) : undefined}
              />
            ))
        ) : dashboard.loading || dashboard.error || !operational ? null : (
          <EmptyState icon="guests" title={t('recentGuests.empty')} body={t('recentGuests.emptyBody')} />
        )}
      </View>

      {operational ? (
        <NewestMembers
          members={operational.newestMembers}
          onSeeAll={can.members(role) ? () => router.push('/members' as Href) : undefined}
          onOpen={can.members(role) ? (id) => router.push(`/members/${id}` as Href) : undefined}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  shortcut: { width: '31.5%', alignItems: 'center', gap: 7, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shortcutPrimary: { backgroundColor: colors.flame },
  shortcutLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  alertDot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 2 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
});
