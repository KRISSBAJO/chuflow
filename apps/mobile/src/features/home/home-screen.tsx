import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HomeHero } from '@/components/home-hero';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Caption, EmptyState, ListRow, Notice, Screen, Section, tap } from '@/components/ui';
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
import { NewestMembers } from './operational-blocks';
import { query } from '@/lib/api';
import type { MeetingListResponse } from '@/features/meetings/types';
import type { DashboardOverview } from './types';

/*
 * Scoped mobile Home: a compact welcome, readable metrics, a priority task and everyday actions.
 * Detailed analytics stay in Reports; children's workers retain their dedicated workspace.
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
  const [days, setDays] = useState(() => user?.preferences?.defaultReportDays ?? 30);
  const [showAllNeeds, setShowAllNeeds] = useState(false);
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
  const visibleShortcuts = shortcuts.slice(0, 3);

  const data = dashboard.data;
  const metrics = data?.metrics;
  const operational = data?.operational;
  const recent = operational?.recentGuests ?? [];
  const needsYou = (summary?.items ?? []).filter((item) => item.count > 0).sort((a, b) => Number(b.tone === 'critical') - Number(a.tone === 'critical'));
  const priority = needsYou[0];
  const scopeLabel = data?.scope.kind === 'all_network' ? t('allNetwork') : (data?.scope.label ?? (typeof user?.branchId === 'object' ? user.branchId?.name : undefined));
  const meetings = useApi<MeetingListResponse>(can.meetings(role) ? `/meetings${query({ from: today.toISOString(), sort: 'oldest', limit: 2, page: 1 })}` : null);
  const primary = shortcuts[0];

  return (
    <Screen
      refreshing={dashboard.refreshing}
      onRefresh={() => {
        void dashboard.refresh();
        void refreshAlerts();
        void meetings.refresh();
      }}
      contentStyle={{ gap: space.xl }}
    >
      <HomeHero
        dateLabel={format.longDate(today)}
        person={user ?? undefined}
        onProfile={() => router.push('/more')}
        primaryLabel={primary?.label ?? tc('tabs.more')}
        onPrimary={() => router.push(primary?.href ?? '/more')}
        greeting={format.greeting(today)}
        name={user?.firstName || t('friend')}
        scope={[scopeLabel, tc('time.lastNDays', { count: days })].filter(Boolean).join(' · ')}
        alerts={summary?.quickStats.activeAlerts ?? 0}
        alertsLabel={t('alertsLabel', { count: summary?.quickStats.activeAlerts ?? 0 })}
        onAlerts={() => router.push(priority ? routeForAlert(priority.href) : '/more')}
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

      {dashboard.error && !metrics ? (
        <View style={styles.connection}>
          <Caption>{dashboard.error}</Caption>
          <Pressable accessibilityRole="button" onPress={() => void dashboard.refresh()}>
            <Text style={styles.retry}>{tc('actions.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.priority}>
        <Section
          title={t('welcome.nextUp')}
          action={needsYou.length > 1 ? t(showAllNeeds ? 'shortcuts.showLess' : 'shortcuts.showAll') : undefined}
          onAction={() => setShowAllNeeds(!showAllNeeds)}
        />
        {priority ? (
          <ListRow
            title={`${format.number(priority.count)} ${priority.label}`}
            subtitle={priority.description}
            left={<View style={[styles.alertDot, { backgroundColor: ALERT_DOT[priority.tone] ?? colors.flame }]} />}
            right={
              <View style={styles.priorityArrow}>
                <Icon name="arrowUpRight" size={19} color={colors.flame} />
              </View>
            }
            onPress={() => router.push(routeForAlert(priority.href))}
          />
        ) : summary ? (
          <View style={styles.caughtUp}>
            <Icon name="check" size={17} color={colors.success} />
            <Caption>{t('needsYou.caughtUp')}</Caption>
          </View>
        ) : (
          <Caption>{tc('state.loading')}</Caption>
        )}
        {showAllNeeds
          ? needsYou
              .slice(1)
              .map((item) => (
                <ListRow
                  key={item.key}
                  divider
                  title={`${format.number(item.count)} ${item.label}`}
                  subtitle={item.description}
                  onPress={() => router.push(routeForAlert(item.href))}
                />
              ))
          : null}
      </View>

      {shortcuts.length ? (
        <View>
          <Section title={t('shortcuts.title')} action={t('shortcuts.showAll')} onAction={() => router.push('/more')} />
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

      <DaysRow title={t('overview.title')} value={days} options={DAY_OPTIONS} onChange={setDays} label={(count) => t('overview.days', { count })} />

      {can.reports(role) ? (
        <ListRow
          title={t('welcome.insights')}
          subtitle={t('welcome.insightsHint')}
          left={<Icon name="reports" size={21} color={colors.flame} />}
          onPress={() => router.push('/reports' as Href)}
        />
      ) : null}

      {meetings.data?.items.length ? (
        <View>
          <Section title={t('welcome.upcoming')} action={tc('actions.seeAll')} onAction={() => router.push('/meetings' as Href)} />
          {meetings.data.items
            .filter((meeting) => meeting.status !== 'cancelled')
            .slice(0, 2)
            .map((meeting, index) => (
              <ListRow
                key={meeting._id}
                divider={index > 0}
                title={meeting.title}
                subtitle={format.dateTime(meeting.startsAt)}
                left={<Icon name="calendar" size={20} color={colors.flame} />}
                onPress={() => router.push(`/meetings/${meeting._id}` as Href)}
              />
            ))}
        </View>
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
  connection: { padding: 14, borderRadius: 14, backgroundColor: colors.surface, gap: 8 },
  retry: { fontFamily: fonts.semibold, color: colors.flame, fontSize: 13 },
  priority: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.hairlineStrong },
  priorityArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.flameSoft, alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  shortcut: { width: '31.5%', alignItems: 'center', gap: 7, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shortcutPrimary: { backgroundColor: colors.flame },
  shortcutLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  alertDot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 2 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
});
