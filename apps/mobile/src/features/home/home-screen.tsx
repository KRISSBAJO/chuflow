import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Sheet, StatGrid, StatTile } from '@/components/kit';
import { Reveal } from '@/components/motion';
import { Caption, ErrorState, ListRow, Notice, Screen, Section } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import type { MeetingListResponse } from '@/features/meetings/types';
import type { ReportsSummary } from '@/features/reports/types';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useAlerts } from '@/lib/alerts';
import { usePlan } from '@/lib/entitlements';
import { query } from '@/lib/api';
import { routeForAlert } from '@/lib/notifications';
import { openWorkspaceBrowser } from '@/lib/open-workspace-browser';
import { useOnline } from '@/lib/offline-queue';
import { can } from '@/lib/permissions';
import { useSession, userBranchId, userId } from '@/lib/session';
import type { AlertsSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { DaysRow } from './days-row';
import { BranchHealth, Watchlist } from './executive-blocks';
import { ActionsCard, GuestStrip, HeroBand, PulseCard, type QuickAction } from './home-blocks';
import { HomeShortcuts } from './home-shortcuts';
import { FollowUpPipeline, NewestMembers } from './operational-blocks';
import { nextLocalService, type HomeServiceSchedule } from './today';
import type { DashboardOverview } from './types';

const DAY_OPTIONS = [7, 30, 90] as const;
type Series = 'attendance' | 'guests' | 'firstTimers';
const SERIES: Series[] = ['attendance', 'guests', 'firstTimers'];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const EXECUTIVE_SHORTCUTS = ['approvals', 'reports', 'attendance', 'followUp'];
const CARE_SHORTCUTS = ['followUp', 'guests', 'attendance', 'approvals'];
const USHER_SHORTCUTS = ['attendance', 'guests', 'finance', 'meetings'];

export function HomeScreen() {
  const { user, workspaces, showWorkspacePicker } = useSession();
  const { summary, refresh: refreshAlerts } = useAlerts();
  const online = useOnline();
  const t = useT('home');
  const tc = useT('common');
  const tw = useT('auth.workspacePicker');
  const format = useAppFormat();
  const role = user?.role;
  const { allows, readOnly } = usePlan();
  const [days, setDays] = useState(() => user?.preferences?.defaultReportDays ?? 30);
  const [showAllNeeds, setShowAllNeeds] = useState(false);
  const [series, setSeries] = useState<Series>('attendance');
  const [today, setToday] = useState(() => new Date());

  const dashboard = useApi<DashboardOverview>(`/reports/dashboard?days=${days}`);
  const reports = useApi<ReportsSummary>(can.reports(role) ? `/reports/summary${query({ days })}` : null);
  const meetings = useApi<MeetingListResponse>(can.meetings(role) && allows('meetings') ? `/meetings${query({ from: today.toISOString(), sort: 'oldest', limit: 3, page: 1 })}` : null);
  const localBranchId = !can.pickBranch(role) && can.attendance(role) && allows('attendance') ? userBranchId(user) : '';
  const schedules = useApi<HomeServiceSchedule[]>(localBranchId ? `/service-schedules${query({ branchId: localBranchId })}` : null);
  const service = nextLocalService(schedules.data ?? [], today);

  const data = dashboard.data?.scope.days === days ? dashboard.data : undefined;
  const reportData = reports.data?.range.days === days ? reports.data : undefined;
  const metrics = data?.metrics;
  const operational = data?.operational;
  const recent = operational?.recentGuests ?? [];
  const needsYou = (summary?.items ?? []).filter((item) => item.count > 0).sort((a, b) => Number(b.tone === 'critical') - Number(a.tone === 'critical'));
  const priority = needsYou[0];
  const scopeLabel = data?.scope.kind === 'all_network' ? t('allNetwork') : (data?.scope.label ?? (typeof user?.branchId === 'object' ? user.branchId?.name : undefined));
  const upcoming = (meetings.data?.items ?? []).filter((meeting) => meeting.status !== 'cancelled').slice(0, 2);
  const nextMeeting = upcoming[0];
  const executive = can.executive(role) && data?.scope.kind !== 'branch' ? data?.executive : undefined;
  const showService = service && (service.isToday || !nextMeeting) ? service : undefined;
  const otherMeetings = showService ? upcoming : upcoming.slice(1);
  const serviceTypeId = typeof showService?.schedule.serviceTypeId === 'string' ? showService.schedule.serviceTypeId : showService?.schedule.serviceTypeId?._id;
  const canRecordService = !readOnly && showService?.isToday && showService.schedule.attendanceEntryEnabled && serviceTypeId && can.recordAttendance(role);

  /* ---- pulse: the chosen series over the range, and this week against the one before ---- */
  const trends = reportData?.trends ?? [];
  const values = trends.map((point) => point[series]);
  const total = sum(values);
  const thisWeek = sum(values.slice(-7));
  const lastWeek = sum(values.slice(-14, -7));
  const delta = thisWeek - lastWeek;
  const deltaTone: 'up' | 'down' | 'flat' = values.length < 14 || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const deltaLabel = !values.length
    ? t('pulse.noData')
    : values.length < 14
      ? undefined
      : delta === 0
        ? t('pulse.flat')
        : t(delta > 0 ? 'pulse.up' : 'pulse.down', { value: format.number(Math.abs(delta)) });

  const pulseMetrics = [
    { key: 'guests', label: t('metrics.guests'), value: !metrics ? '—' : format.number(metrics.totalGuests), onPress: can.guests(role) ? () => router.push('/guests') : undefined },
    {
      key: 'attendance',
      label: t('metrics.attendance'),
      value: !metrics ? '—' : format.number(metrics.totalAttendance),
      onPress: can.attendance(role) ? () => router.push('/attendance') : undefined,
    },
    {
      key: 'members',
      label: t('metrics.members'),
      value: !metrics ? '—' : format.number(metrics.totalMembers),
      onPress: can.members(role) ? () => router.push('/members' as Href) : undefined,
    },
    {
      key: 'followUp',
      label: t('metrics.followUp'),
      value: !metrics ? '—' : format.number(metrics.pendingFollowUp),
      onPress: can.followUp(role) ? () => router.push('/follow-up') : undefined,
    },
  ];

  /* ---- shortcuts ordered around the signed-in person's work ---- */
  const pendingApprovals = summary?.quickStats.pendingApprovals ?? 0;
  const actions: QuickAction[] = (
    [
      { key: 'attendance', icon: 'attendance', label: t('shortcuts.attendance'), onPress: () => router.push('/attendance'), show: can.attendance(role) && allows('attendance') },
      {
        key: 'followUp',
        icon: 'care',
        label: t('shortcuts.followUp'),
        onPress: () => router.push('/follow-up'),
        show: can.followUp(role) && allows('follow_up'),
        badge: summary?.quickStats.pendingFollowUp,
      },
      { key: 'approvals', icon: 'approvals', label: t('shortcuts.approvals'), onPress: () => router.push('/approvals'), show: can.approvals(role), badge: pendingApprovals },
      { key: 'members', icon: 'members', label: t('shortcuts.members'), onPress: () => router.push('/members' as Href), show: can.members(role) && allows('members') },
      { key: 'kids', icon: 'smile', label: t('shortcuts.kids'), onPress: () => router.push('/kids' as Href), show: can.kids(role) && !can.kidsOnly(role) && allows('kids') },
      { key: 'meetings', icon: 'calendar', label: t('shortcuts.meetings'), onPress: () => router.push('/meetings' as Href), show: can.meetings(role) && allows('meetings') },
      { key: 'finance', icon: 'finance', label: t('shortcuts.finance'), onPress: () => router.push('/finance' as Href), show: can.finance(role) && allows('finance') },
      { key: 'reports', icon: 'reports', label: t('shortcuts.reports'), onPress: () => router.push('/reports' as Href), show: can.reports(role) && allows('reporting') },
      { key: 'guests', icon: 'guests', label: t('metrics.guests'), onPress: () => router.push('/guests'), show: can.guests(role) && allows('guests') },
    ] as (QuickAction & { show: boolean })[]
  )
    .filter((action) => action.show)
    .map(({ show: _show, ...action }) => action);
  const preferred = can.executive(role) ? EXECUTIVE_SHORTCUTS : role === 'follow_up' ? CARE_SHORTCUTS : role === 'usher' ? USHER_SHORTCUTS : [];
  const orderedActions = [...preferred.flatMap((key) => actions.filter((action) => action.key === key)), ...actions.filter((action) => !preferred.includes(action.key))];
  const shortcutsKey = `chuflow.homeShortcuts.${JSON.stringify([user?.workspace?.id, userId(user)])}`;

  const openAlert = ({ key, href }: AlertsSummary['items'][number]) => {
    if (key === 'attendance_watch') {
      router.push('/attendance-history');
      return;
    }
    const [path] = href.split('?');
    if (path === '/branches' || path === '/evangelism') {
      void openWorkspaceBrowser(href, user?.workspace);
      return;
    }
    router.push(routeForAlert(href));
  };

  const alertTitle = (item: AlertsSummary['items'][number]) => {
    const count = item.count;
    switch (item.key) {
      case 'care_overdue': return t('needsYou.overdueCare', { count });
      case 'care_unassigned': return t('needsYou.careOwners', { count });
      case 'attendance_watch': return t('needsYou.attendanceMissing', { count });
      default: return `${format.number(count)} ${item.label}`;
    }
  };

  const alertRow = (item: AlertsSummary['items'][number], index: number, onPress: () => void) => (
    <ListRow key={item.key} divider={index > 0} title={alertTitle(item)} subtitle={item.description}
      left={<Icon name={item.key.startsWith('attendance') ? 'attendance' : item.key.startsWith('meeting') ? 'calendar' : item.key.endsWith('approvals') ? 'approvals' : item.key === 'missing_leadership' ? 'members' : 'care'} size={19} color={colors.warning} />}
      onPress={onPress} />
  );

  return (
    <Screen
      refreshing={dashboard.refreshing}
      onRefresh={() => {
        void dashboard.refresh();
        void reports.refresh();
        void refreshAlerts();
        void meetings.refresh();
        void schedules.refresh();
        setToday(new Date());
      }}
      contentStyle={{ gap: space.xl }}
    >
      <HeroBand
        dateLabel={format.longDate(today)}
        greeting={format.greeting(today)}
        name={user?.firstName || t('friend')}
        workspace={user?.workspace?.name ? {
          name: user.workspace.name,
          pickerLabel: tw('title'),
          onPress: workspaces.length > 1 ? showWorkspacePicker : undefined,
        } : undefined}
        scope={scopeLabel}
        alerts={summary?.quickStats.activeAlerts ?? 0}
        alertsLabel={t('alertsLabel', { count: summary?.quickStats.activeAlerts ?? 0 })}
        onAlerts={() => priority ? openAlert(priority) : router.push('/more')}
        person={user}
        profileLabel={t('welcome.profile')}
        onProfile={() => router.push('/more')}
        searchLabel={can.search(role) ? t('searchTips.homeHint') : undefined}
        onSearch={can.search(role) ? () => router.push('/search' as Href) : undefined}
      />

      {!online ? (
        <Notice tone="warning" icon="cloudOff">
          {t('offline')}
        </Notice>
      ) : null}

      <Reveal delay={40}>
        {priority ? (
          <View style={{ gap: space.sm }}>
            <Section title={t('needsYou.title')} />
            <ActionsCard
              tone="alert"
              kicker={t('needsYou.actions', { count: needsYou.length })}
              title={alertTitle(priority)}
              detail={priority.description}
              hint={t(priority.key === 'care_overdue' ? 'needsYou.reviewCare' : 'welcome.viewTask')}
              onPress={() => openAlert(priority)}
            />
          </View>
        ) : summary ? <Caption style={{ color: colors.success }}>{t('needsYou.caughtUp')}</Caption> : null}
        {needsYou.length > 1 ? (
          <View style={{ marginTop: space.sm }}>
            {needsYou.slice(1, 3).map((item, index) => alertRow(item, index, () => openAlert(item)))}
            {needsYou.length > 3 ? (
              <ListRow title={t('shortcuts.showAll')} divider onPress={() => setShowAllNeeds(true)} />
            ) : null}
          </View>
        ) : null}
      </Reveal>
      {showAllNeeds ? (
        <Sheet visible title={t('needsYou.title')} onClose={() => setShowAllNeeds(false)}>
          <ScrollView>
            {needsYou.map((item, index) => alertRow(item, index, () => { setShowAllNeeds(false); openAlert(item); }))}
          </ScrollView>
        </Sheet>
      ) : null}

      {showService ? (
        <ActionsCard
          tone="calm"
          kicker={t(showService.isToday ? 'welcome.today' : 'welcome.nextService')}
          title={showService.schedule.name}
          detail={[format.date(showService.start, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }), showService.schedule.locationNotes].filter(Boolean).join(' · ')}
          hint={t(canRecordService ? 'welcome.recordAttendance' : 'shortcuts.attendance')}
          onPress={() => canRecordService ? router.push({ pathname: '/attendance/new', params: { serviceTypeId, date: showService.start.toISOString().slice(0, 10) } }) : router.push('/attendance')}
        />
      ) : nextMeeting ? (
        <ActionsCard tone="calm" kicker={t('welcome.nextGathering')} title={nextMeeting.title}
          detail={[format.dateTime(nextMeeting.startsAt), nextMeeting.location].filter(Boolean).join(' · ')}
          hint={t('welcome.viewMeeting')} onPress={() => router.push(`/meetings/${nextMeeting._id}` as Href)} />
      ) : null}

      {actions.length ? (
        <Reveal delay={90}>
          <HomeShortcuts key={shortcutsKey} actions={orderedActions} storageKey={shortcutsKey} />
        </Reveal>
      ) : null}

      {dashboard.error && !metrics ? <ErrorState message={dashboard.error} onRetry={() => void dashboard.refresh()} /> : null}

      <Reveal delay={140}>
        {can.reports(role) ? (
          <PulseCard
            title={t('pulse.title')}
            value={reportData ? format.number(total) : '—'}
            caption={`${t(`pulse.${series}`)} · ${tc('time.lastNDays', { count: days })}`}
            deltaLabel={reportData ? deltaLabel : (reports.error ?? undefined)}
            deltaTone={deltaTone}
            series={values}
            tabs={SERIES.map((value) => ({ value, label: t(`pulse.${value}`) }))}
            tab={series}
            onTab={(value) => setSeries(value as Series)}
            dayOptions={DAY_OPTIONS}
            days={days}
            onDays={setDays}
            dayLabel={(count) => t('overview.days', { count })}
            metrics={pulseMetrics}
          />
        ) : (
          <View>
            <DaysRow title={t('overview.title')} value={days} options={DAY_OPTIONS} onChange={setDays} label={(count) => t('overview.days', { count })} />
            <StatGrid>
              {pulseMetrics.map((metric) => (
                <StatTile key={metric.key} label={metric.label} value={metric.value} onPress={metric.onPress} />
              ))}
            </StatGrid>
          </View>
        )}
      </Reveal>

      {recent.length ? (
        <Reveal delay={180}>
          <GuestStrip
            title={t('recentGuests.strip')}
            guests={recent.slice(0, 10)}
            seeAll={can.guests(role) ? tc('actions.seeAll') : undefined}
            onSeeAll={() => router.push('/guests')}
            onOpen={can.guests(role) ? (id) => router.push(`/guest/${id}`) : undefined}
            nameOf={(guest) => guest.firstName || format.fullName(guest)}
            statusOf={(guest) => (guest.visitStatus ? format.status(guest.visitStatus) : '')}
          />
        </Reveal>
      ) : null}

      {otherMeetings.length ? (
        <View>
          <Section title={t('welcome.upcoming')} action={tc('actions.seeAll')} onAction={() => router.push('/meetings' as Href)} />
          {otherMeetings.map((meeting, index) => (
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

      {operational?.followUpPipeline?.length ? (
        <FollowUpPipeline pipeline={operational.followUpPipeline} onOpen={can.followUp(role) ? () => router.push('/follow-up') : undefined} />
      ) : null}

      {operational ? (
        <NewestMembers
          members={operational.newestMembers}
          onSeeAll={can.members(role) ? () => router.push('/members' as Href) : undefined}
          onOpen={can.members(role) ? (id) => router.push(`/members/${id}` as Href) : undefined}
        />
      ) : null}

      {executive ? (
        <>
          <Watchlist executive={executive} />
          <BranchHealth leaders={executive.topGrowthBranches} attention={executive.bottomGrowthBranches} />
        </>
      ) : null}

      {can.reports(role) ? (
        <ListRow
          title={t('welcome.insights')}
          subtitle={t('welcome.insightsHint')}
          left={<Icon name="reports" size={21} color={colors.flame} />}
          onPress={() => router.push('/reports' as Href)}
        />
      ) : null}
    </Screen>
  );
}
