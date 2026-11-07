import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Banner, LiveDot, Meter, SearchBar, SheetPicker, StatGrid, StatTile, Timeline, type TimelineItem } from '@/components/kit';
import { Reveal } from '@/components/motion';
import { Button, Caption, Card, EmptyState, ErrorState, Heading, ListRow, Loading, Screen, ScreenHeader, Section, Segmented, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { getWorkspaceWebUrl, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { familyInitials, formatAgeRange } from './age';
import { InitialAvatar, KIDS, Kicker, kidsHref, PHASE_TONE, PhaseBadge, RoomCard, useMinuteNow } from './shared';
import type { AgeBucket, ChildrenOverview, LiveSession, Phase } from './types';

const REFRESH_MS = 20_000;
const AGE_ORDER: AgeBucket[] = ['under3', '3to5', '6to9', '10to12', 'teens'];
const EVENT_KEYS = ['session_created', 'check_in', 'check_out', 'checkout_exception', 'transfer', 'reissue', 'session_closed'];

function eventTone(action: string): TimelineItem['tone'] {
  if (action === 'check_in') return 'success';
  if (action === 'check_out') return 'info';
  if (action === 'checkout_exception' || action === 'session_closed') return 'danger';
  if (action === 'transfer' || action === 'reissue') return 'warning';
  return 'neutral';
}

/**
 * The Kids workspace home: branch picker, live board when a session is open, ministry stats,
 * attendance trend, age mix, sessions and the family directory. Rendered by the Kids tab for
 * children's staff and by /kids for leaders (`inStack` drops the safe-area top padding).
 */
export function KidsHome({ inStack = false }: { inStack?: boolean }) {
  const t = useT('kids.home');
  const tk = useT('kids.common');
  const tc = useT('common');
  const format = useAppFormat();
  const { user } = useSession();
  const role = user?.role;
  const pickBranch = can.pickBranch(role);
  const supervise = can.kidsSupervise(role);

  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);
  const [branchId, setBranchId] = useState(userBranchId(user));
  const [view, setView] = useState<'today' | 'families' | 'insights'>('today');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overview = useApi<ChildrenOverview>(
    `/children${query({ branchId, search: debounced, page: page > 1 ? page : undefined, sessionPage: sessionPage > 1 ? sessionPage : undefined })}`,
  );
  const { reload } = overview;

  // The live board stays fresh while this screen is in front.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => void reload(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload]),
  );

  const data = branchId && overview.data?.branchId !== branchId ? undefined : overview.data;
  const effectiveBranch = branchId || data?.branchId || '';
  const branchOptions = useMemo(() => (branches.data ?? []).map((b) => ({ value: b._id, label: b.name, hint: [b.city, b.district].filter(Boolean).join(' · ') })), [branches.data]);
  const stats = data?.stats;
  const ageTotal = stats ? AGE_ORDER.reduce((sum, key) => sum + stats.ageMix[key], 0) : 0;
  const trendMax = Math.max(1, ...(data?.trend ?? []).map((p) => p.attended));

  const openDesk = (id: string, tab?: string, room?: string) => router.push(kidsHref(`/kids/sessions/${id}`, { tab, room }));
  const openWebsite = (path: string) => void WebBrowser.openBrowserAsync(`${getWorkspaceWebUrl()}${path}`);

  return (
    <Screen safeTop={!inStack} refreshing={overview.refreshing} onRefresh={() => void overview.refresh()}>
      {inStack ? (
        <Stack.Screen options={{ title: tk('title') }} />
      ) : (
        <ScreenHeader title={tk('title')} subtitle={data && data.branches.length === 1 ? data.branches[0].name : undefined} />
      )}

      {pickBranch && branchOptions.length > 1 ? (
        <SheetPicker
          label={tk('church')}
          value={effectiveBranch}
          options={branchOptions}
          onChange={(value) => {
            setBranchId(value);
            setPage(1);
            setSessionPage(1);
            setSearch('');
            setView('today');
          }}
          searchable={branchOptions.length > 6}
        />
      ) : null}

      <View style={styles.welcome}>
        <Image
          source={require('@/assets/images/kids-welcome.webp')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="right"
          accessible={false}
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={['#fff4df', 'rgba(255,244,223,0.95)', 'rgba(255,244,223,0)']}
          locations={[0, 0.32, 0.7]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.welcomeTitle}>{t('welcome.title')}</Text>
        <Text style={styles.welcomeCaption}>{t('welcome.subtitle')}</Text>
      </View>
      {data ? (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: t('tabs.today') },
            ...(data.canManage ? [{ value: 'families' as const, label: t('tabs.families'), count: data.pagination.total }] : []),
            ...(stats ? [{ value: 'insights' as const, label: t('tabs.insights') }] : []),
          ]}
        />
      ) : null}
      {view !== 'today' && data?.live?.phase === 'overdue' ? (
        <Banner
          tone="danger"
          icon="alert"
          title={t('live.overdue', { count: data.live.present })}
          action={<Button label={t('live.pickup')} variant="danger" size="sm" onPress={() => openDesk(data.live!._id, 'pickup')} />}
        />
      ) : null}
      {overview.loading || (!data && !overview.error) ? <Loading /> : null}
      {overview.error && !data ? <ErrorState message={overview.error} onRetry={() => void overview.refresh()} /> : null}
      {data && !data.branches.length ? <EmptyState icon="lock" title={tk('noAccess')} /> : null}

      {view === 'today' ? (
        <>
          {data?.live ? (
            <LiveBoard
              live={data.live}
              canManage={data.canManage}
              onDesk={(tab, room) => openDesk(data.live!._id, tab, room)}
              onScan={() => router.push(kidsHref('/kids/scan', { sessionId: data.live!._id, tab: 'checkin' }))}
            />
          ) : data ? (
            <Card style={{ gap: space.sm, backgroundColor: KIDS.greenSoft }}>
              <Kicker>{tk('title')}</Kicker>
              <Heading>{t('quiet.title')}</Heading>
              <Caption>{data.canManage && supervise ? t('quiet.manager') : t('quiet.worker')}</Caption>
              {data.canManage && supervise ? (
                <Button
                  label={t('quiet.cta')}
                  icon="door"
                  style={{ alignSelf: 'flex-start', marginTop: space.xs }}
                  onPress={() => router.push(kidsHref('/kids/sessions/new', { branchId: effectiveBranch }))}
                />
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {view === 'insights' && stats ? (
        <>
          <Section title={t('stats.title')} />
          <StatGrid>
            <StatTile label={t('stats.children')} value={format.number(stats.children)} hint={t('stats.childrenHint')} tone="success" />
            <StatTile label={t('stats.families')} value={format.number(stats.families)} hint={t('stats.familiesHint')} />
            <StatTile label={t('stats.newChildren')} value={format.number(stats.newChildren)} hint={t('stats.newHint')} tone="warning" />
            <StatTile label={t('stats.visiting')} value={format.number(stats.visiting)} hint={t('stats.visitingHint')} tone="info" />
            {data?.canManage ? <StatTile label={t('stats.birthdays')} value={format.number(stats.birthdays.length)} /> : null}
            {data?.canManage ? (
              <StatTile
                label={t('stats.pending')}
                value={format.number(stats.pendingRegistrations)}
                hint={t('stats.pendingHint')}
                tone={stats.pendingRegistrations ? 'danger' : 'neutral'}
                onPress={() => openWebsite(`/children/registrations?branchId=${effectiveBranch}`)}
              />
            ) : null}
          </StatGrid>
        </>
      ) : null}

      {view === 'insights' && data ? (
        <>
          <Section title={t('trend.title')} />
          <Card style={{ gap: space.md }}>
            <Caption>{t('trend.subtitle')}</Caption>
            {data.trend.length ? (
              <>
                <View style={styles.bars}>
                  {data.trend.map((point) => (
                    <Pressable key={point._id} style={styles.barSlot} onPress={() => openDesk(point._id)} accessibilityLabel={`${point.name} · ${point.attended}`}>
                      <Text style={styles.barValue}>{point.attended}</Text>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(4, Math.round((point.attended / trendMax) * 64)), backgroundColor: point.status === 'open' ? KIDS.amber : KIDS.green },
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.tableHead}>
                  <Text style={[styles.cell, styles.cellWide, type.micro]}>{t('trend.session')}</Text>
                  <Text style={[styles.cell, type.micro]}>{t('trend.date')}</Text>
                  <Text style={[styles.cell, styles.cellNum, type.micro]}>{t('trend.attended')}</Text>
                  <Text style={[styles.cell, styles.cellNum, type.micro]}>{t('trend.capacity')}</Text>
                </View>
                {data.trend
                  .slice()
                  .reverse()
                  .map((point) => (
                    <View key={point._id} style={styles.tableRow}>
                      <Text style={[styles.cell, styles.cellWide, type.small, { color: colors.ink }]} numberOfLines={1}>
                        {point.name}
                      </Text>
                      <Text style={[styles.cell, type.small]} numberOfLines={1}>
                        {format.shortDate(point.startsAt)}
                      </Text>
                      <Text style={[styles.cell, styles.cellNum, type.small, { color: colors.ink }]}>{format.number(point.attended)}</Text>
                      <Text style={[styles.cell, styles.cellNum, type.small]}>{format.number(point.capacity)}</Text>
                    </View>
                  ))}
              </>
            ) : (
              <Caption>{t('trend.empty')}</Caption>
            )}
          </Card>

          <Section title={t('ages.title')} />
          <Card style={{ gap: space.md }}>
            <Caption>{t('ages.subtitle')}</Caption>
            {stats && ageTotal > 0 ? (
              AGE_ORDER.map((key) => {
                const count = stats.ageMix[key];
                return (
                  <View key={key} style={{ gap: 4 }}>
                    <View style={styles.ageRow}>
                      <Text style={type.label}>{t(`ages.${key}`)}</Text>
                      <Caption>
                        {format.number(count)} · {format.number(count / ageTotal, { style: 'percent', maximumFractionDigits: 0 })}
                      </Caption>
                    </View>
                    <Meter value={count} max={ageTotal} tone="success" />
                  </View>
                );
              })
            ) : (
              <Caption>{t('ages.empty')}</Caption>
            )}
          </Card>
        </>
      ) : null}

      {view === 'insights' && data?.canManage && stats ? (
        <>
          <Section title={t('birthdays.title')} />
          {stats.birthdays.length ? (
            stats.birthdays.map((child, index) => (
              <ListRow
                key={child._id}
                divider={index > 0}
                title={child.name}
                subtitle={`${t('birthdays.turning', { age: child.turning })} · ${format.date(child.date, { weekday: 'short', day: 'numeric', month: 'short' })}`}
                left={<InitialAvatar text={familyInitials(child.name)} tone="amber" />}
                onPress={() => router.push(kidsHref(`/kids/families/${child.familyId}`))}
              />
            ))
          ) : (
            <Caption>{t('birthdays.empty')}</Caption>
          )}
        </>
      ) : null}

      {view === 'today' && data ? (
        <>
          <Section
            title={`${t('sessions.title')} · ${t('sessions.subtitle', { count: data.sessionPagination.total })}`}
            action={data.canManage && supervise && !data.live ? t('sessions.new') : undefined}
            onAction={() => router.push(kidsHref('/kids/sessions/new', { branchId: effectiveBranch }))}
          />
          {data.sessions.length ? (
            data.sessions.map((session) => {
              const phase: Phase = session.status === 'closed' ? 'closed' : data.live && data.live._id === session._id ? data.live.phase : 'live';
              return (
                <Pressable
                  key={session._id}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    openDesk(session._id);
                  }}
                  style={({ pressed }) => [styles.sessionRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={type.label} numberOfLines={1}>
                      {session.name}
                    </Text>
                    <Caption numberOfLines={1}>
                      {format.dateTime(session.startsAt)} · {t('sessions.rooms', { count: session.rooms })}
                    </Caption>
                    <Caption numberOfLines={1}>
                      {t('sessions.hereNow', { count: format.number(session.present) })} · {t('sessions.attended', { count: format.number(session.attended) })}
                    </Caption>
                  </View>
                  <PhaseBadge phase={phase} />
                  <Icon name="chevronRight" size={15} color={colors.faint} />
                </Pressable>
              );
            })
          ) : (
            <EmptyState icon="door" title={t('sessions.empty')} />
          )}
          {data.sessionPagination.totalPages > 1 ? (
            <Pager
              page={data.sessionPagination.page}
              total={data.sessionPagination.totalPages}
              label={t('sessions.page', { page: data.sessionPagination.page, total: data.sessionPagination.totalPages })}
              prev={t('sessions.newer')}
              next={t('sessions.older')}
              onChange={setSessionPage}
            />
          ) : null}
        </>
      ) : null}

      {view === 'families' && data?.canManage ? (
        <>
          <Section title={`${t('families.title')} · ${t('families.registered', { count: data.pagination.total })}`} />
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('families.placeholder')} />
          {data.families.length ? (
            data.families.map((family, index) => (
              <ListRow
                key={family._id}
                divider={index > 0}
                title={family.name}
                subtitle={`${t('families.children', { count: family.childCount })} · ${t('families.guardians', { count: family.guardianCount })}`}
                left={<InitialAvatar text={familyInitials(family.name)} />}
                onPress={() => router.push(kidsHref(`/kids/families/${family._id}`))}
              />
            ))
          ) : (
            <EmptyState icon="guests" title={debounced ? tc('state.noMatches') : t('families.empty')} body={debounced ? tc('state.noMatchesHint') : undefined} />
          )}
          {data.pagination.totalPages > 1 ? (
            <Pager
              page={data.pagination.page}
              total={data.pagination.totalPages}
              label={t('families.page', { page: data.pagination.page, total: data.pagination.totalPages })}
              prev={tc('actions.back')}
              next={tc('actions.next')}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Pager({ page, total, label, prev, next, onChange }: { page: number; total: number; label: string; prev: string; next: string; onChange: (page: number) => void }) {
  return (
    <View style={styles.pager}>
      <Button label={prev} variant="secondary" size="sm" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <Caption>{label}</Caption>
      <Button label={next} variant="secondary" size="sm" disabled={page >= total} onPress={() => onChange(page + 1)} />
    </View>
  );
}

function LiveBoard({ live, canManage, onDesk, onScan }: { live: LiveSession; canManage: boolean; onDesk: (tab?: string, room?: string) => void; onScan: () => void }) {
  const t = useT('kids.home.live');
  const ta = useT('kids.age');
  const format = useAppFormat();
  const now = useMinuteNow();
  const ends = new Date(live.endsAt);
  const timing =
    live.phase === 'upcoming'
      ? t('startsIn', { time: format.relativeTime(live.startsAt) })
      : ends.getTime() > now
        ? t('endsIn', { time: format.relativeTime(live.endsAt) })
        : t('endedAgo', { time: format.relativeTime(live.endsAt) });

  const events: TimelineItem[] = live.recent.map((event, index) => ({
    key: `${event.at}-${index}`,
    title: t(`events.${EVENT_KEYS.includes(event.action) ? event.action : 'other'}`, { count: event.count }),
    subtitle: event.kiosk ? t('byKiosk') : t('byStaff'),
    at: format.time(event.at),
    tone: eventTone(event.action),
  }));

  const stats: { key: string; label: string; value: number; color: string }[] = [
    { key: 'here', label: t('hereNow'), value: live.present, color: colors.ink },
    { key: 'attended', label: t('attended'), value: live.attended, color: colors.ink },
    { key: 'collected', label: t('collected'), value: live.collected, color: colors.ink },
    { key: 'rooms', label: t('rooms'), value: live.rooms.length, color: colors.ink },
  ];

  return (
    <View style={{ gap: space.lg }}>
      {/* Keep the service desk light; reserve strong color for actions and safety alerts. */}
      <Reveal>
        <View style={styles.live}>
          <View style={styles.liveTop}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.liveRow}>
                <LiveDot tone={PHASE_TONE[live.phase]} size={8} />
                <Text style={[styles.liveEyebrow, { flex: 1 }]}>{t('eyebrow')}</Text><PhaseBadge phase={live.phase} />
              </View>
              <Text style={styles.liveName} numberOfLines={2}>
                {live.name}
              </Text>
              <Text style={styles.liveWindow} numberOfLines={2}>
                {t('window', { start: format.date(live.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' }), end: format.time(live.endsAt) })} · {timing}
              </Text>
            </View>
          </View>

          <View style={styles.liveStats}>
            {stats.map((stat) => (
              <View key={stat.key} style={styles.liveStat}>
                <Text style={[styles.liveStatValue, { color: stat.color }]} numberOfLines={1}>
                  {format.number(stat.value)}
                </Text>
                <Text style={styles.liveStatLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button label={t('desk')} icon="door" variant="flame" size="lg" style={{ flex: 1.3 }} onPress={() => onDesk('checkin')} />
            <Button label={t('scan')} icon="camera" variant="secondary" size="lg" style={[{ flex: 1 }, styles.quietAction]} onPress={onScan} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}><Text style={[styles.liveHint, { flex: 1, marginTop: 0 }]}>{t('scanHint')}</Text><Button label={t('pickup')} variant="secondary" size="sm" style={styles.quietAction} onPress={() => onDesk('pickup')} /></View>
        </View>
      </Reveal>

      {live.phase === 'overdue' ? (
        <Reveal delay={60}>
          <Banner
            tone="danger"
            icon="alert"
            title={t('overdue', { count: live.present })}
            action={<Button label={t('pickup')} size="sm" variant="danger" onPress={() => onDesk('pickup')} />}
          />
        </Reveal>
      ) : null}
      {live.phase === 'ending' ? (
        <Reveal delay={60}>
          <Banner tone="success" icon="check" title={t('allHome')} />
        </Reveal>
      ) : null}

      <Reveal delay={100}>
        <Section title={t('rooms')} />
        <View style={styles.roomGrid}>
          {live.rooms.map((room) => (
            <RoomCard
              key={room.id}
              name={room.name}
              subtitle={formatAgeRange(
                room.minMonths,
                room.maxMonths,
                (count) => ta('months', { count }),
                (count) => ta('years', { count }),
              )}
              present={room.present}
              capacity={room.capacity}
              onPress={() => onDesk('rooms', room.id)}
              style={styles.roomHalf}
            />
          ))}
        </View>
      </Reveal>

      <Reveal delay={160}>
        <Section title={t('activity')} action={canManage ? t('supervisor') : t('pickup')} onAction={() => onDesk(canManage ? 'supervisor' : 'pickup')} />
        {events.length ? <Timeline items={events} /> : <Caption>{t('noActivity')}</Caption>}
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { height: 166, borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff4df', padding: 18, justifyContent: 'center' },
  welcomeTitle: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 23, letterSpacing: -0.5, color: KIDS.green, maxWidth: '51%' },
  welcomeCaption: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 14, color: '#5d634a', maxWidth: '42%', marginTop: 8 },
  live: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: 20, padding: space.lg, gap: space.lg, overflow: 'hidden' },
  liveTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveEyebrow: { ...type.micro, textTransform: 'uppercase', color: colors.muted },
  liveName: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: colors.ink },
  liveWindow: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  liveStats: { flexDirection: 'row', gap: 8 },
  liveStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  liveStatValue: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  liveStatLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 1 },
  liveHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: -space.sm },
  quietAction: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  roomHalf: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.page, borderColor: colors.hairlineStrong, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 88, paddingTop: 4 },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  barValue: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  bar: { width: '100%', borderRadius: 4, opacity: 0.85 },
  tableHead: { flexDirection: 'row', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong, paddingBottom: 4 },
  tableRow: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  cell: { flex: 1, minWidth: 0 },
  cellWide: { flex: 2 },
  cellNum: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  ageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, borderRadius: radius.md },
});
