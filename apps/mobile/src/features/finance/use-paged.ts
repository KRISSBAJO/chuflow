import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import type { Paginated } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Infinite-scroll paging over a paginated endpoint, the same idea as the guests tab: the first
 * page comes from `useApi` (so it refreshes on focus and pull-to-refresh), later pages belong to
 * the first page they extend and are dropped whenever that page reloads.
 */
export function usePaged<T, R extends Paginated<T> = Paginated<T>>(pathFor: ((page: number) => string) | null) {
  const first = useApi<R>(pathFor ? pathFor(1) : null);
  const [more, setMore] = useState<{ base: R | undefined; items: T[]; page: number }>({ base: undefined, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const current = more.base === first.data ? more : { items: [] as T[], page: 1 };
  const items: T[] = [...(first.data?.items ?? []), ...current.items];
  const totalPages = first.data?.pagination.totalPages ?? 1;
  const hasMore = !!first.data && current.page < totalPages;

  const loadMore = useCallback(async () => {
    if (!pathFor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await api.get<R>(pathFor(current.page + 1));
      setMore({ base: first.data, items: [...current.items, ...next.items], page: current.page + 1 });
    } catch {
      // The next scroll or a pull-to-refresh tries again.
    } finally {
      setLoadingMore(false);
    }
  }, [current.items, current.page, first.data, hasMore, loadingMore, pathFor]);

  return { ...first, items, loadMore, loadingMore, hasMore };
}
