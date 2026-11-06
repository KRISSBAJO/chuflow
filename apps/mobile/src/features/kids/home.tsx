import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Banner, Meter, SearchBar, SheetPicker, StatGrid, StatTile, Timeline, type TimelineItem } from '@/components/kit';
import { Button, Caption, Card, EmptyState, ErrorState, Heading, ListRow, Loading, Screen, ScreenHeader, Section, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { query } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { can } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { familyInitials, formatAgeRange } from './age';
import { InitialAvatar, KIDS, Kicker, kidsHref, PhaseBadge, RoomCard, useMinuteNow } from './shared';
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

  const overview = useApi<ChildrenOverview>(`/children${query({ branchId, search: debounced, page: page > 1 ? page : undefined, sessionPage: sessionPage > 1 ? sessionPage : undefined })}`);
  const { reload } = overview;

  // The live board stays fresh while this screen is in front.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => void reload(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload]),
  );

  const data = overview.data;
  const effectiveBranch = branchId || data?.branchId || '';
  const branchOptions = useMemo(() => (branches.data ?? []).map((b) => ({ value: b._id, label: b.name, hint: [b.city, b.district].filter(Boolean).join(' · ') })), [branches.data]);
  const stats = data?.stats;
  const ageTotal = stats ? AGE_ORDER.reduce((sum, key) => sum + stats.ageMix[key], 0) : 0;
  const trendMax = Math.max(1, ...(data?.trend ?? []).map((p) => p.attended));

  const openDesk = (id: string, tab?: string, room?: string) => router.push(kidsHref(`/kids/sessions/${id}`, { tab, room }));
  const openWebsite = (path: string) => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);

  return (
    <Screen safeTop={!inStack} refreshing={overview.refreshing} onRefresh={() => void overview.refresh()}>
      {inStack ? <Stack.Screen options={{ title: tk('title') }} /> : <ScreenHeader title={tk('title')} subtitle={data && data.branches.length === 1 ? data.branches[0].name : undefined} />}

      {pickBranch && branchOptions.length > 1 ? <SheetPicker label={tk('church')} value={effectiveBranch} options={branchOptions} onChange={setBranchId} searchable={branchOptions.length > 6} /> : null}

      {overview.loading ? <Loading /> : null}
      {overview.error && !data ? <ErrorState message={overview.error} onRetry={() => void overview.refresh()} /> : null}
      {data && !data.branches.length ? <EmptyState icon="lock" title={tk('noAccess')} /> : null}

      {data?.live ? (
        <LiveBoard live={data.live} canManage={data.canManage} onDesk={(tab, room) => openDesk(data.live!._id, tab, room)} onScan={() => router.push(kidsHref('/kids/scan', { sessionId: data.live!._id, tab: 'checkin' }))} />
      ) : data ? (
        <Card style={{ gap: space.sm, backgroundColor: KIDS.greenSoft }}>
          <Kicker>{tk('title')}</Kicker>
          <Heading>{t('quiet.title')}</Heading>
          <Caption>{data.canManage && supervise ? t('quiet.manager') : t('quiet.worker')}</Caption>
          {data.canManage && supervise ? (
            <Button label={t('quiet.cta')} icon="door" style={{ alignSelf: 'flex-start', marginTop: space.xs }} onPress={() => router.push(kidsHref('/kids/sessions/new', { branchId: effectiveBranch }))} />
          ) : null}
        </Card>
      ) : null}

      {stats ? (
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

      {data ? (
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
                      <View style={[styles.bar, { height: Math.max(4, Math.round((point.attended / trendMax) * 64)), backgroundColor: point.status === 'open' ? KIDS.amber : KIDS.green }]} />
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

      {data?.canManage && stats ? (
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

      {data ? (
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

      {data?.canManage ? (
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

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <Kicker>{t('eyebrow')}</Kicker>
        <View style={styles.liveTitle}>
          <Heading style={{ flex: 1 }} numberOfLines={2}>
            {live.name}
          </Heading>
          <PhaseBadge phase={live.phase} />
        </View>
        <Caption>
          {t('window', { start: format.date(live.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' }), end: format.time(live.endsAt) })} · {timing}
        </Caption>
      </View>

      {live.phase === 'overdue' ? <Banner tone="danger" icon="alert" title={t('overdue', { count: live.present })} action={<Button label={t('pickup')} size="sm" variant="danger" onPress={() => onDesk('pickup')} />} /> : null}
      {live.phase === 'ending' ? <Banner tone="success" icon="check" title={t('allHome')} /> : null}

      <StatGrid>
        <StatTile label={t('hereNow')} value={format.number(live.present)} tone="success" />
        <StatTile label={t('attended')} value={format.number(live.attended)} />
        <StatTile label={t('collected')} value={format.number(live.collected)} tone="info" />
        <StatTile label={t('rooms')} value={format.number(live.rooms.length)} tone="warning" />
      </StatGrid>

      <View style={styles.roomGrid}>
        {live.rooms.map((room) => (
          <RoomCard
            key={room.id}
            name={room.name}
            subtitle={formatAgeRange(room.minMonths, room.maxMonths, (count) => ta('months', { count }), (count) => ta('years', { count }))}
            present={room.present}
            capacity={room.capacity}
            onPress={() => onDesk('rooms', room.id)}
            style={styles.roomHalf}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button label={t('desk')} icon="door" size="lg" style={{ flex: 1.3 }} onPress={() => onDesk('checkin')} />
        <Button label={t('scan')} icon="camera" variant="secondary" size="lg" style={{ flex: 1 }} onPress={onScan} />
      </View>
      <Caption>{t('scanHint')}</Caption>

      <View style={{ gap: space.sm }}>
        <View style={styles.liveTitle}>
          <Text style={[type.label, { flex: 1 }]}>{t('activity')}</Text>
          <Pressable hitSlop={8} onPress={() => onDesk(canManage ? 'supervisor' : 'pickup')}>
            <Text style={styles.link}>{canManage ? t('supervisor') : t('pickup')}</Text>
          </Pressable>
        </View>
        {events.length ? <Timeline items={events} /> : <Caption>{t('noActivity')}</Caption>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  liveTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  roomHalf: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.inset },
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
  link: { fontFamily: fonts.medium, fontSize: 13, color: KIDS.green },
});
