import { router, Stack, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { SearchBar } from '@/components/kit';
import { Caption, EmptyState, ErrorState, ListRow, Loading, Screen, Section } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { getWorkspaceWebUrl, query } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import type { GlobalSearchResponse, GlobalSearchResultItem } from './types';

/*
 * Global search, the website's /search page as a modal: one box, results grouped by type.
 * Tapping opens the phone screen when there is one, otherwise the website.
 */

const MIN_CHARS = 2;
const LIMIT = 10;

type Group = { key: keyof GlobalSearchResponse['results']; type: string; icon: IconName; total: keyof GlobalSearchResponse['totals'] };

const GROUPS: Group[] = [
  { key: 'guests', type: 'guests', icon: 'guests', total: 'guests' },
  { key: 'members', type: 'members', icon: 'members', total: 'members' },
  { key: 'followUps', type: 'followups', icon: 'care', total: 'followUps' },
  { key: 'branches', type: 'branches', icon: 'building', total: 'branches' },
  { key: 'users', type: 'users', icon: 'user', total: 'users' },
];

/** The phone screen for a result, or null when only the website has one. */
export function phoneRoute(item: GlobalSearchResultItem): Href | null {
  const path = item.href.split('?')[0];
  const params = new URLSearchParams(item.href.split('?')[1] ?? '');
  const last = path.split('/').filter(Boolean).pop() ?? '';
  switch (item.entityType) {
    case 'guests':
      return `/guest/${item._id}`;
    case 'members':
      return `/members/${item._id}` as Href;
    case 'followups': {
      const guestId = params.get('guestId');
      return guestId ? `/guest/${guestId}` : null;
    }
    default:
      break;
  }
  if (path.startsWith('/children/families/')) return `/kids/families/${last}` as Href;
  if (path.startsWith('/meetings/')) return `/meetings/${last}` as Href;
  if (path.startsWith('/care-cases/')) return `/care-cases/${last}` as Href;
  return null;
}

export function SearchScreen() {
  const { user } = useSession();
  const t = useT('search');
  const allowed = can.search(user?.role);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const active = allowed && debounced.length >= MIN_CHARS;
  const results = useApi<GlobalSearchResponse>(active ? `/search/global${query({ q: debounced, limit: LIMIT })}` : null);
  const data = results.data;
  // The reply names its query, so results for an older search aren't shown as the new one's.
  const fresh = !!data && data.query === debounced;

  function open(item: GlobalSearchResultItem) {
    const route = phoneRoute(item);
    if (route) router.push(route);
    else void WebBrowser.openBrowserAsync(`${getWorkspaceWebUrl()}${item.href}`);
  }

  return (
    <Screen safeTop={false} contentStyle={{ gap: space.lg }}>
      <Stack.Screen options={{ title: t('title') }} />
      {allowed ? <SearchBar value={text} onChangeText={setText} placeholder={t('placeholder')} autoFocus /> : null}

      {!allowed ? (
        <EmptyState icon="lock" title={t('locked.title')} />
      ) : !active ? (
        <EmptyState icon="search" title={t('start.title')} body={t('start.body')} />
      ) : results.error && !fresh ? (
        <ErrorState message={results.error} onRetry={() => void results.reload()} />
      ) : !fresh ? (
        <Loading />
      ) : data.totals.total === 0 ? (
        <EmptyState icon="search" title={t('noMatches.title')} body={t('noMatches.body', { query: debounced })} />
      ) : (
        GROUPS.filter((group) => data.results[group.key].length > 0).map((group) => {
          const items = data.results[group.key];
          const total = data.totals[group.total];
          return (
            <View key={group.key}>
              <Section title={`${t(`types.${group.type}`)} · ${t('results', { count: total })}`} />
              {items.map((item, index) => {
                const onPhone = !!phoneRoute(item);
                return (
                  <ListRow
                    key={`${item.entityType}-${item._id}`}
                    divider={index > 0}
                    title={item.title}
                    subtitle={[item.subtitle, item.meta].filter(Boolean).join(' · ')}
                    left={
                      <View style={styles.leftIcon}>
                        <Icon name={group.icon} size={16} color={colors.muted} />
                      </View>
                    }
                    right={onPhone ? undefined : <Icon name="arrowUpRight" size={14} color={colors.faint} />}
                    chevron={onPhone}
                    onPress={() => open(item)}
                  />
                );
              })}
              {total > items.length ? <Caption style={styles.showing}>{t('showing', { shown: items.length, total })}</Caption> : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  leftIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  showing: { paddingTop: space.sm },
});
