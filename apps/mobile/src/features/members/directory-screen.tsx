import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SearchBar, SheetPicker, StatGrid, StatTile } from '@/components/kit';
import { Avatar, Badge, Caption, EmptyState, ErrorState, ListRow, Loading, RoundAction, ScreenHeader, Segmented } from '@/components/ui';
import { Reveal } from '@/components/motion';
import { colors, space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, query } from '@/lib/api';
import { branchName, statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { memberDisplayName, useMemberLabels } from './labels';
import { MEMBERSHIP_STATUSES, memberGroupNames, type MemberDirectoryResponse, type MemberListItem } from './types';

const PAGE_SIZE = 25;
const ALL = 'all';

type StatusFilter = typeof ALL | (typeof MEMBERSHIP_STATUSES)[number];

/** The members directory: GET /members/directory with search, status and branch filters, paged. */
export function MembersDirectoryScreen() {
  const t = useT('members.list');
  const tm = useT('members');
  const tc = useT('common');
  const labels = useMemberLabels();
  const format = useAppFormat();
  const { user } = useSession();
  const allowed = can.members(user?.role);
  const pickBranch = allowed && can.pickBranch(user?.role);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [branchId, setBranchId] = useState('');
  const [more, setMore] = useState<{ base: MemberDirectoryResponse | undefined; items: MemberListItem[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const branches = useApi<BranchSummary[]>(pickBranch ? '/branches' : null);
  const params = useMemo(
    () => ({ search: debounced, status: status === ALL ? '' : status, branchId, pageSize: PAGE_SIZE }),
    [debounced, status, branchId],
  );
  const first = useApi<MemberDirectoryResponse>(allowed ? `/members/directory${query({ ...params, page: 1 })}` : null);

  const current = more.base === first.data ? more : { items: [], page: 1 };
  const page = current.page;
  const items = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.pagination.totalPages ?? 1;

  async function loadMore() {
    if (loadingMore || page >= totalPages || !first.data) return;
    setLoadingMore(true);
    try {
      const next = await api.get<MemberDirectoryResponse>(`/members/directory${query({ ...params, page: page + 1 })}`);
      setMore({ base: first.data, items: [...current.items, ...next.items], page: page + 1 });
    } catch {
      // The next scroll or a pull-to-refresh tries again.
    } finally {
      setLoadingMore(false);
    }
  }

  if (!allowed) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={tm('noAccess')} />
      </View>
    );
  }

  const total = first.data?.pagination.total;
  const subtitle = total === undefined ? ' ' : debounced || status !== ALL || branchId ? t('matching', { count: total }) : t('count', { count: total });
  const branchOptions = [{ value: ALL, label: t('allBranches') }, ...(branches.data ?? []).map((branch) => ({ value: branch._id, label: branch.name }))];
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: ALL, label: t('allStatuses') },
    ...MEMBERSHIP_STATUSES.map((value) => ({ value, label: labels.membershipStatus(value) })),
  ];

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('title') }} />
      <FlatList
        data={first.loading || (first.error && !first.data) ? [] : items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={first.refreshing} onRefresh={() => void first.refresh()} tintColor={colors.flame} colors={[colors.flame]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListHeaderComponent={
          <Reveal style={styles.header}>
            <ScreenHeader title={t('title')} subtitle={subtitle} right={<RoundAction icon="plus" label={t('add')} tone="dark" onPress={() => router.push('/members/new' as Href)} />} />
            {first.data ? (
              <StatGrid columns={3}>
                <StatTile label={t('stats.active')} value={format.number(first.data.summary.active)} tone="success" onPress={() => setStatus('active')} />
                <StatTile label={t('stats.pendingConversion')} value={format.number(first.data.summary.pendingConversion)} tone="flame" onPress={() => router.push('/guests' as Href)} />
                <StatTile label={t('stats.foundation')} value={format.number(first.data.summary.foundationPending)} />
              </StatGrid>
            ) : null}
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('searchPlaceholder')} />
            {pickBranch ? (
              <SheetPicker label={tc('fields.branch')} value={branchId || ALL} options={branchOptions} onChange={(value) => setBranchId(value === ALL ? '' : value)} />
            ) : null}
            <Segmented options={statusOptions} value={status} onChange={setStatus} />
          </Reveal>
        }
        renderItem={({ item, index }) => {
          const groups = memberGroupNames(item);
          const subtitleParts = [item.recordType === 'child' ? t('child') : item.phone, pickBranch ? branchName(item.branchId) : '', groups].filter(Boolean);
          return (
            <ListRow
              divider={index > 0}
              title={memberDisplayName(labels, item, tc('state.unnamed'))}
              subtitle={subtitleParts.join(' · ')}
              left={<Avatar person={item} size={34} />}
              right={<Badge label={labels.membershipStatus(item.membershipStatus)} tone={statusTone(item.membershipStatus)} />}
              chevron={false}
              onPress={() => router.push(`/members/${item._id}` as Href)}
            />
          );
        }}
        ListEmptyComponent={
          first.loading ? (
            <Loading />
          ) : first.error ? (
            <ErrorState message={first.error} onRetry={() => void first.refresh()} />
          ) : (
            <EmptyState
              icon="members"
              title={debounced || status !== ALL ? t('noMatches') : t('emptyTitle')}
              body={debounced || status !== ALL ? t('noMatchesHint') : t('emptyBody')}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? <Loading /> : first.data && page >= totalPages && items.length > 8 ? <Caption style={styles.end}>{t('endOfList')}</Caption> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.page, paddingBottom: space.xxl },
  header: { paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  end: { textAlign: 'center', paddingVertical: space.lg },
});
