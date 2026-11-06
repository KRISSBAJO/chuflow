import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SearchBar, SheetPicker, StatGrid, StatTile } from '@/components/kit';
import { Avatar, Badge, Caption, EmptyState, ErrorState, ListRow, Loading, ScreenHeader, Segmented } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { stageTone, useCareLabel } from './labels';
import { careOwner, CARE_VIEWS, type CareListItem, type CareListResponse, type CareOptions, type CareOverview, type CareView } from './types';

const PAGE_SIZE = 25;
const ALL = 'all';

/** The care hub: overview tiles from GET /care/overview and the queue from GET /care/cases. */
export function CareListScreen() {
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();
  const t = useT('care.list');
  const tcare = useT('care');
  const tc = useT('common');
  const label = useCareLabel();
  const format = useAppFormat();
  const { user } = useSession();
  const allowed = can.careCases(user?.role);
  const pickBranch = allowed && can.pickBranch(user?.role);

  const [search, setSearch] = useState(initialQuery ?? '');
  const [debounced, setDebounced] = useState(initialQuery?.trim() ?? '');
  const [view, setView] = useState<CareView>('all');
  const [branchId, setBranchId] = useState('');
  const [more, setMore] = useState<{ base: CareListResponse | undefined; items: CareListItem[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const options = useApi<CareOptions>(pickBranch ? '/care/options' : null);
  const overview = useApi<CareOverview>(allowed ? `/care/overview${query({ branchId })}` : null);
  const params = useMemo(() => ({ view, q: debounced, branchId, limit: PAGE_SIZE }), [view, debounced, branchId]);
  const first = useApi<CareListResponse>(allowed ? `/care/cases${query({ ...params, page: 1 })}` : null);

  const current = more.base === first.data ? more : { items: [], page: 1 };
  const page = current.page;
  const items = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.totalPages ?? 1;

  async function loadMore() {
    if (loadingMore || page >= totalPages || !first.data) return;
    setLoadingMore(true);
    try {
      const next = await api.get<CareListResponse>(`/care/cases${query({ ...params, page: page + 1 })}`);
      setMore({ base: first.data, items: [...current.items, ...next.items], page: page + 1 });
    } catch {
      // The next scroll or a pull-to-refresh tries again.
    } finally {
      setLoadingMore(false);
    }
  }

  function refresh() {
    void overview.refresh();
    void first.refresh();
  }

  if (!allowed) {
    return (
      <View style={styles.page}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={tcare('noAccess')} />
      </View>
    );
  }

  const branchOptions = [{ value: ALL, label: t('allBranches') }, ...(options.data?.branches ?? []).map((branch) => ({ value: branch._id, label: branch.name }))];
  const subtitle = first.data ? t('count', { count: first.data.total }) : ' ';

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: t('title') }} />
      <FlatList
        data={first.loading || (first.error && !first.data) ? [] : items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={first.refreshing} onRefresh={refresh} tintColor={colors.flame} colors={[colors.flame]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title={t('title')} subtitle={subtitle} />
            {overview.data ? (
              <StatGrid>
                <StatTile label={t('stats.people')} value={format.number(overview.data.total)} onPress={() => setView('all')} />
                <StatTile label={t('stats.needOwner')} value={format.number(overview.data.unassigned)} tone={overview.data.unassigned ? 'warning' : 'neutral'} onPress={() => setView('unassigned')} />
                <StatTile label={t('stats.overdue')} value={format.number(overview.data.overdue)} tone={overview.data.overdue ? 'danger' : 'neutral'} onPress={() => setView('overdue')} />
                <StatTile label={t('stats.retention')} value={format.number(overview.data.retention)} tone={overview.data.retention ? 'flame' : 'neutral'} onPress={() => setView('retention')} />
              </StatGrid>
            ) : null}
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('searchPlaceholder')} />
            {pickBranch ? (
              <SheetPicker label={tc('fields.branch')} value={branchId || ALL} options={branchOptions} onChange={(value) => setBranchId(value === ALL ? '' : value)} />
            ) : null}
            <Segmented options={CARE_VIEWS.map((value) => ({ value, label: t(`views.${value}`) }))} value={view} onChange={setView} />
          </View>
        }
        renderItem={({ item, index }) => {
          const owner = careOwner(item.ownerId);
          const next = item.nextTask;
          const parts = [
            label(item.journey),
            owner ? t('with', { name: `${owner.firstName} ${owner.lastName}` }) : t('unassigned'),
            next ? `${t('dueOn', { date: format.shortDate(next.dueAt) })}${next.escalated ? ` · ${t('escalated')}` : ''}` : t('noOpenTask'),
          ];
          return (
            <ListRow
              divider={index > 0}
              title={`${item.firstName} ${item.lastName}`}
              subtitle={parts.join(' · ')}
              left={<Avatar person={item} size={34} />}
              right={<Badge label={item.stopContact ? t('contactStopped') : label(item.stage)} tone={stageTone(item.stage, item.stopContact)} />}
              chevron={false}
              onPress={() => router.push(`/care-cases/${item._id}` as Href)}
            />
          );
        }}
        ListEmptyComponent={
          first.loading ? (
            <Loading />
          ) : first.error ? (
            <ErrorState message={first.error} onRetry={refresh} />
          ) : (
            <EmptyState icon="care" title={t('emptyTitle')} body={t('emptyBody')} />
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
