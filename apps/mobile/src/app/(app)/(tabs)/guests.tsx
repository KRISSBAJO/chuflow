import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { Avatar, Badge, Caption, EmptyState, ErrorState, ListRow, Loading, RoundAction, ScreenHeader } from '@/components/ui';
import { Reveal } from '@/components/motion';
import { colors, fonts, radius, space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, query } from '@/lib/api';
import { statusTone } from '@/lib/format';
import type { GuestListItem, GuestListResponse } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const PAGE_SIZE = 25;

export default function GuestsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT('guests.list');
  const common = useT('common');
  const format = useAppFormat();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // Later pages belong to the first page they extend; a new search or refresh drops them.
  const [more, setMore] = useState<{ base: GuestListResponse | undefined; items: GuestListItem[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const first = useApi<GuestListResponse>(`/guests${query({ search: debounced, page: 1, limit: PAGE_SIZE })}`);

  const current = more.base === first.data ? more : { items: [], page: 1 };
  const page = current.page;
  const items = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.pagination.totalPages ?? 1;

  async function loadMore() {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = await api.get<GuestListResponse>(`/guests${query({ search: debounced, page: page + 1, limit: PAGE_SIZE })}`);
      setMore({ base: first.data, items: [...current.items, ...next.items], page: page + 1 });
    } catch {
      // The pull-to-refresh or next scroll will try again.
    } finally {
      setLoadingMore(false);
    }
  }

  const subtitle = first.data
    ? [
        t(debounced ? 'matching' : 'inScope', { count: format.number(first.data.pagination.total) }),
        t('today', { count: format.number(first.data.summary.todayCount) }),
      ].join(' · ')
    : ' ';

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <FlatList
        data={first.loading || (first.error && !first.data) ? [] : items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={first.refreshing} onRefresh={() => void first.refresh()} tintColor={colors.flame} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void loadMore()}
        ListHeaderComponent={
          <Reveal style={styles.header}>
            <ScreenHeader
              title={common('areas.guests')}
              subtitle={subtitle}
              right={<RoundAction icon="plus" label={t('register')} tone="dark" onPress={() => router.push('/guest/new')} />}
            />
            <View style={styles.search}>
              <Icon name="search" size={16} color={colors.faint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor="#b0ada6"
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
          </Reveal>
        }
        renderItem={({ item, index }) => {
          const status = item.nextFollowUpStatus || item.visitStatus;
          return (
            <ListRow
              divider={index > 0}
              title={format.fullName(item)}
              subtitle={[item.phone, format.relativeTime(item.createdAt)].filter(Boolean).join(' · ')}
              left={<Avatar person={item} size={34} />}
              right={status ? <Badge label={format.status(status)} tone={statusTone(status)} /> : undefined}
              chevron={false}
              onPress={() => router.push(`/guest/${item._id}`)}
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
              icon="guests"
              title={debounced ? common('state.noMatches') : t('emptyTitle')}
              body={debounced ? common('state.noMatchesHint') : t('emptyBody')}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? <Loading /> : first.data && page >= totalPages && items.length > 8 ? <Caption style={styles.end}>{common('state.endOfList')}</Caption> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.page, paddingBottom: space.xxl },
  header: { paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: colors.ink, height: '100%' },
  end: { textAlign: 'center', paddingVertical: space.lg },
});
