import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Caption, EmptyState, ErrorState, IconButton, ListRow, Loading, Screen, Segmented } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { minutesLabel, MINUTES_TONE, participantCount, STATUS_TONE, statusLabel } from './shared';
import { refName, type MeetingListItem, type MeetingListResponse } from './types';

const PAGE_SIZE = 25;
type Scope = 'upcoming' | 'past';

/** Meetings list: upcoming first, past ones newest first, with a header "+" for schedulers. */
export function MeetingsList() {
  const t = useT('meetings');
  const common = useT('common');
  const format = useAppFormat();
  const { user } = useSession();
  const [scope, setScope] = useState<Scope>('upcoming');
  // Keep the pivot stable across renders so the first page key does not change every second.
  const [pivot] = useState(() => new Date().toISOString());
  const [more, setMore] = useState<{ base: MeetingListResponse | undefined; items: MeetingListItem[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const path = (page: number) =>
    `/meetings${query(scope === 'upcoming' ? { from: pivot, sort: 'oldest', page, limit: PAGE_SIZE } : { to: pivot, sort: 'newest', page, limit: PAGE_SIZE })}`;
  const first = useApi<MeetingListResponse>(path(1));
  const current = more.base === first.data ? more : { items: [], page: 1 };
  const items = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.totalPages ?? 1;

  async function loadMore() {
    if (loadingMore || current.page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = await api.get<MeetingListResponse>(path(current.page + 1));
      setMore({ base: first.data, items: [...current.items, ...next.items], page: current.page + 1 });
    } catch {
      // Pull to refresh tries again.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen safeTop={false} refreshing={first.refreshing} onRefresh={() => void first.refresh()}>
      <Stack.Screen
        options={{
          title: t('list.title'),
          headerRight: can.meetings(user?.role) ? () => <IconButton icon="plus" label={t('list.schedule')} onPress={() => router.push('/meetings/new' as Href)} /> : undefined,
        }}
      />
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: t('list.upcoming') },
          { value: 'past', label: t('list.past') },
        ]}
      />
      {first.data ? <Caption>{t('list.total', { count: first.data.total })}</Caption> : null}

      {first.loading ? (
        <Loading />
      ) : first.error && !first.data ? (
        <ErrorState message={first.error} onRetry={() => void first.refresh()} />
      ) : !items.length ? (
        <EmptyState
          icon="calendar"
          title={t(scope === 'upcoming' ? 'list.emptyUpcoming' : 'list.emptyPast')}
          body={t('list.emptyHint')}
          action={can.meetings(user?.role) && scope === 'upcoming' ? <Button label={t('list.schedule')} icon="plus" onPress={() => router.push('/meetings/new' as Href)} /> : undefined}
        />
      ) : (
        <View>
          {items.map((m, i) => {
            const minutes = minutesLabel(t, m);
            const where = [refName(m.groupId) || refName(m.branchId), m.location || (m.joinUrl ? t('details.online') : '')].filter(Boolean).join(' · ');
            return (
              <ListRow
                key={m._id}
                divider={i > 0}
                title={m.title}
                subtitle={`${format.dateTime(m.startsAt)}${where ? ` · ${where}` : ''}`}
                left={
                  <View style={styles.date}>
                    <Text style={styles.day}>{format.date(m.startsAt, { day: 'numeric' })}</Text>
                    <Text style={styles.month}>{format.date(m.startsAt, { month: 'short' })}</Text>
                  </View>
                }
                right={
                  <View style={styles.badges}>
                    <Badge label={statusLabel(t, m.status)} tone={STATUS_TONE[m.status] ?? 'neutral'} />
                    {minutes ? <Badge label={minutes} tone={MINUTES_TONE[m.minutesOverdue ? 'overdue' : m.minutesStatus] ?? 'neutral'} /> : null}
                    <Caption>{t('list.participants', { count: participantCount(m) })}</Caption>
                  </View>
                }
                onPress={() => router.push(`/meetings/${m._id}` as Href)}
              />
            );
          })}
          {current.page < totalPages ? (
            <View style={{ paddingTop: space.md }}>
              <Button label={t('list.loadMore')} variant="secondary" size="sm" loading={loadingMore} onPress={() => void loadMore()} />
            </View>
          ) : items.length > 8 ? (
            <Caption style={{ textAlign: 'center', paddingTop: space.md }}>{common('state.endOfList')}</Caption>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: 10, backgroundColor: colors.surface },
  day: { ...type.number, fontSize: 18, color: colors.ink },
  month: { ...type.micro, color: colors.muted, textTransform: 'uppercase' },
  badges: { alignItems: 'flex-end', gap: 4, maxWidth: 140 },
});
