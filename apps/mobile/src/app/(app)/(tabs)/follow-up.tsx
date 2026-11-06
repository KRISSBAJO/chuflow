import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, ErrorState, Loading, RoundAction, ScreenHeader, Segmented, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, query } from '@/lib/api';
import { dialable, statusTone } from '@/lib/format';
import { useSession, userId } from '@/lib/session';
import type { FollowUpItem, FollowUpListResponse } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Filter = 'todo' | 'mine' | 'all' | 'done';

const FILTER_STATUS: Record<Filter, string | undefined> = {
  todo: 'new',
  mine: undefined,
  all: undefined,
  done: 'returned',
};

const STATUS_COLOR: Record<string, string> = {
  warning: '#f59e0b',
  info: '#0ea5e9',
  success: '#10b981',
  danger: '#ef4444',
  neutral: '#b0ada6',
  flame: colors.flame,
};

const PAGE_SIZE = 30;

export default function FollowUpScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const t = useT('followUp.list');
  const common = useT('common');
  const isWorker = user?.role === 'follow_up';
  const [filter, setFilter] = useState<Filter>(isWorker ? 'mine' : 'todo');
  // Later pages belong to the first page they extend; a new filter or refresh drops them.
  const [more, setMore] = useState<{ base: FollowUpListResponse | undefined; items: FollowUpItem[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const params = {
    status: FILTER_STATUS[filter],
    assignedTo: filter === 'mine' && !isWorker ? userId(user) : undefined,
    limit: PAGE_SIZE,
  };
  const first = useApi<FollowUpListResponse>(`/follow-ups${query({ ...params, page: 1 })}`);

  const current = more.base === first.data ? more : { items: [], page: 1 };
  const page = current.page;
  const items = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.pagination.totalPages ?? 1;
  const counts = first.data?.summary;

  async function loadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = await api.get<FollowUpListResponse>(`/follow-ups${query({ ...params, page: page + 1 })}`);
      setMore({ base: first.data, items: [...current.items, ...next.items], page: page + 1 });
    } catch {
      // Scrolling again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  const filters: { value: Filter; label: string; count?: number }[] = isWorker
    ? [
        { value: 'mine', label: t('assignedToMe'), count: counts?.total },
        { value: 'done', label: t('returned') },
      ]
    : [
        { value: 'todo', label: t('notStarted'), count: counts?.new },
        { value: 'mine', label: t('mine') },
        { value: 'all', label: t('all') },
        { value: 'done', label: t('returned') },
      ];

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <FlatList
        data={first.loading || (first.error && !first.data) ? [] : items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={first.refreshing} onRefresh={() => void first.refresh()} tintColor={colors.flame} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title={common('areas.followUp')} subtitle={t('subtitle')} />
            <Segmented options={filters} value={filter} onChange={setFilter} />
          </View>
        }
        renderItem={({ item, index }) => <FollowUpRow item={item} divider={index > 0} />}
        ListEmptyComponent={
          first.loading ? (
            <Loading />
          ) : first.error ? (
            <ErrorState message={first.error} onRetry={() => void first.refresh()} />
          ) : (
            <EmptyState icon="care" title={t('emptyTitle')} body={t('emptyBody')} />
          )
        }
        ListFooterComponent={loadingMore ? <Loading /> : undefined}
      />
    </View>
  );
}

function FollowUpRow({ item, divider }: { item: FollowUpItem; divider: boolean }) {
  const t = useT('followUp.list');
  const common = useT('common');
  const format = useAppFormat();
  const guest = item.guestId;
  const phone = dialable(guest?.phone);
  const tone = statusTone(item.status);
  const firstName = guest?.firstName ?? '';

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('logHint')}
        onPress={() => {
          tap();
          router.push(`/care/${item._id}`);
        }}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.55 }]}
      >
        <Avatar person={guest} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.label} numberOfLines={1}>
            {format.fullName(guest)}
          </Text>
          <View style={styles.meta}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[tone] }]} />
            <Text style={[type.small, { flexShrink: 1 }]} numberOfLines={1}>
              {[format.status(item.status), item.assignedTo ? item.assignedTo.firstName : common('state.unassigned'), format.relativeTime(item.updatedAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      </Pressable>
      {phone ? (
        <View style={styles.actions}>
          <RoundAction icon="phone" label={t('call', { name: firstName })} onPress={() => void Linking.openURL(`tel:${phone}`)} />
          <RoundAction icon="whatsapp" label={t('whatsapp', { name: firstName })} onPress={() => void Linking.openURL(`https://wa.me/${phone.replace('+', '')}`)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.page, paddingBottom: space.xxl },
  header: { paddingTop: space.md, paddingBottom: space.xs, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', gap: space.sm },
});
