import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { StatGrid, StatTile } from '@/components/kit';
import { Badge, Caption, EmptyState, ErrorState, ListRow, Loading, Screen, Section, Segmented, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { query } from '@/lib/api';
import { statusTone } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { Amount, BranchFilter, daysAgo, moneyOf, periodQuery, RangeChips, startOfMonth, startOfYear } from './shared';
import type {
  ExpenseEntrySummary,
  ExpenseListResponse,
  FinanceLedgerEntrySummary,
  FinanceLedgerResponse,
  OfferingEntrySummary,
  OfferingListResponse,
} from './types';
import { usePaged } from './use-paged';

type Tab = 'offerings' | 'expenses' | 'ledger';
type Range = 'month' | 'days90' | 'year' | 'all';
type Row = OfferingEntrySummary | ExpenseEntrySummary | FinanceLedgerEntrySummary;

const PAGE_SIZE = 25;
const TABS: Tab[] = ['offerings', 'expenses', 'ledger'];
const RANGES: Range[] = ['month', 'days90', 'year', 'all'];

function rangeStart(range: Range, today: Date) {
  if (range === 'month') return startOfMonth(today);
  if (range === 'days90') return daysAgo(today, 90);
  if (range === 'year') return startOfYear(today);
  return null;
}

/** Finance at a phone's scale: the website's ledger, offerings and expenses tabs with the same filters. */
export function FinanceScreen() {
  const t = useT('finance');
  const format = useAppFormat();
  const money = moneyOf(format);
  const { user } = useSession();
  const role = user?.role;
  const allowed = can.finance(role);
  const pickBranch = can.pickBranch(role);
  const canAddOffering = can.recordOfferings(role);
  const canAddExpense = can.recordExpenses(role);

  const [tab, setTab] = useState<Tab>('offerings');
  const [range, setRange] = useState<Range>('month');
  const [branchId, setBranchId] = useState('');
  const [today] = useState(() => new Date());

  const branches = useApi<BranchSummary[]>(allowed && pickBranch ? '/branches' : null);
  const filters = { branchId, ...periodQuery(rangeStart(range, today), today) };

  const offerings = usePaged<OfferingEntrySummary, OfferingListResponse>(
    allowed && tab === 'offerings' ? (page) => `/finance/offerings${query({ ...filters, page, limit: PAGE_SIZE })}` : null,
  );
  const expenses = usePaged<ExpenseEntrySummary, ExpenseListResponse>(
    allowed && tab === 'expenses' ? (page) => `/finance/expenses${query({ ...filters, page, limit: PAGE_SIZE })}` : null,
  );
  const ledger = usePaged<FinanceLedgerEntrySummary, FinanceLedgerResponse>(
    allowed && tab === 'ledger' ? (page) => `/finance/ledger${query({ ...filters, page, limit: PAGE_SIZE })}` : null,
  );
  const active = tab === 'offerings' ? offerings : tab === 'expenses' ? expenses : ledger;

  // Newest first, so the balance after each row counts down from the period's net balance.
  const balances = useMemo(() => {
    const map = new Map<string, number>();
    let running = ledger.data?.summary.netBalance ?? 0;
    for (const item of ledger.items) {
      map.set(item._id, running);
      running -= item.direction === 'credit' ? item.amount : -item.amount;
    }
    return map;
  }, [ledger.data, ledger.items]);

  const addTarget = tab === 'expenses' ? (canAddExpense ? 'expense' : canAddOffering ? 'offering' : null) : canAddOffering ? 'offering' : canAddExpense ? 'expense' : null;
  const currencyOf = (items: { currency?: string }[]) => items[0]?.currency || 'USD';

  if (!allowed) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState icon="lock" title={t('noAccess')} />
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      <Segmented options={TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))} value={tab} onChange={setTab} />
      <RangeChips options={RANGES.map((value) => ({ value, label: t(`range.${value}`) }))} value={range} onChange={setRange} />
      {pickBranch ? <BranchFilter label={t('branch.label')} allLabel={t('branch.all')} branches={branches.data ?? []} value={branchId} onChange={setBranchId} /> : null}

      {tab === 'offerings' && offerings.data ? (
        <StatGrid>
          <StatTile label={t('tiles.offerings')} value={money(offerings.data.summary.totalAmount, currencyOf(offerings.items))} hint={t('tiles.entries', { count: offerings.data.pagination.total })} />
          <StatTile label={t('tiles.thisMonth')} value={money(offerings.data.summary.currentMonthTotal, currencyOf(offerings.items))} />
        </StatGrid>
      ) : null}
      {tab === 'expenses' && expenses.data ? (
        <StatGrid>
          <StatTile label={t('tiles.expenses')} value={money(expenses.data.summary.totalAmount, currencyOf(expenses.items))} hint={t('tiles.entries', { count: expenses.data.pagination.total })} />
          <StatTile
            label={t('tiles.pending')}
            value={money(expenses.data.summary.pendingAmount, currencyOf(expenses.items))}
            hint={t('tiles.pendingCount', { count: expenses.data.summary.pendingCount })}
            tone={expenses.data.summary.pendingCount ? 'warning' : 'neutral'}
          />
        </StatGrid>
      ) : null}
      {tab === 'ledger' && ledger.data ? (
        <>
          <StatGrid>
            <StatTile label={t('tiles.credits')} value={money(ledger.data.summary.totalCredits, currencyOf(ledger.items))} tone="success" />
            <StatTile label={t('tiles.debits')} value={money(ledger.data.summary.totalDebits, currencyOf(ledger.items))} />
            <StatTile
              label={t('tiles.net')}
              value={money(ledger.data.summary.netBalance, currencyOf(ledger.items))}
              hint={t('tiles.creditsLessDebits')}
              tone={ledger.data.summary.netBalance < 0 ? 'danger' : 'neutral'}
            />
            <StatTile label={t('tiles.pendingApprovals')} value={format.number(ledger.data.summary.pendingExpenseApprovals)} tone={ledger.data.summary.pendingExpenseApprovals ? 'warning' : 'neutral'} />
          </StatGrid>
          {ledger.data.byAccount.length ? (
            <View>
              <Section title={t('tiles.byAccount')} />
              {ledger.data.byAccount.map((account, index) => (
                <ListRow
                  key={account.accountId}
                  divider={index > 0}
                  title={account.label}
                  subtitle={t('tiles.inOut', { credits: money(account.totalCredits, currencyOf(ledger.items)), debits: money(account.totalDebits, currencyOf(ledger.items)) })}
                  right={<Amount tone={account.balance < 0 ? 'danger' : 'ink'}>{money(account.balance, currencyOf(ledger.items))}</Amount>}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {active.items.length ? <Section title={t(`tabs.${tab}`)} /> : null}
    </View>
  );

  function renderRow(item: Row, index: number) {
    if (tab === 'offerings') {
      const entry = item as OfferingEntrySummary;
      return (
        <ListRow
          divider={index > 0}
          title={entry.offeringTypeLabel}
          subtitle={[format.date(entry.serviceDate), entry.serviceLabel || entry.serviceTypeLabel, pickBranch ? entry.branchId?.name : ''].filter(Boolean).join(' · ')}
          right={<Amount>{money(entry.amount, entry.currency)}</Amount>}
          chevron={false}
          onPress={() => router.push(`/finance/offerings/${entry._id}` as Href)}
        />
      );
    }
    if (tab === 'expenses') {
      const entry = item as ExpenseEntrySummary;
      return (
        <ListRow
          divider={index > 0}
          title={entry.description}
          subtitle={[format.date(entry.expenseDate), entry.expenseCategoryLabel, entry.payee, pickBranch ? entry.branchId?.name : ''].filter(Boolean).join(' · ')}
          right={
            <View style={styles.rowRight}>
              <Amount>{money(entry.amount, entry.currency)}</Amount>
              <Badge label={format.status(entry.status)} tone={statusTone(entry.status)} />
            </View>
          }
          chevron={false}
          onPress={() => router.push(`/finance/expenses/${entry._id}` as Href)}
        />
      );
    }
    const entry = item as FinanceLedgerEntrySummary;
    const credit = entry.direction === 'credit';
    const source = entry.sourceType === 'offering' || entry.sourceType === 'expense' ? t(`source.${entry.sourceType}`) : format.status(entry.sourceType);
    const target = entry.sourceType === 'offering' ? `/finance/offerings/${entry.sourceId}` : entry.sourceType === 'expense' ? `/finance/expenses/${entry.sourceId}` : null;
    return (
      <ListRow
        divider={index > 0}
        title={entry.description}
        subtitle={[format.date(entry.entryDate), entry.accountLabel, source, pickBranch ? entry.branchId?.name : ''].filter(Boolean).join(' · ')}
        right={
          <View style={styles.rowRight}>
            <Amount tone={credit ? 'success' : 'ink'}>{`${credit ? '+' : '−'}${money(entry.amount, entry.currency)}`}</Amount>
            {entry.status && entry.status !== 'approved' ? (
              <Badge label={format.status(entry.status)} tone={statusTone(entry.status)} />
            ) : (
              <Caption style={styles.balance}>{t('balanceAfter', { amount: money(balances.get(entry._id), entry.currency) })}</Caption>
            )}
          </View>
        }
        chevron={false}
        onPress={target && entry.sourceId ? () => router.push(target as Href) : undefined}
      />
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          title: t('title'),
          headerRight: addTarget
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(`add.${addTarget}`)}
                  hitSlop={10}
                  onPress={() => {
                    tap();
                    router.push((addTarget === 'offering' ? '/finance/offerings/new' : '/finance/expenses/new') as Href);
                  }}
                  style={styles.addButton}
                >
                  <Icon name="plus" size={20} color={colors.ink} strokeWidth={2} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <FlatList<Row>
        data={active.loading || (active.error && !active.data) ? [] : active.items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={active.refreshing} onRefresh={() => void active.refresh()} tintColor={colors.flame} colors={[colors.flame]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void active.loadMore()}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => renderRow(item, index)}
        ListEmptyComponent={
          active.loading ? (
            <Loading />
          ) : active.error ? (
            <ErrorState message={active.error} onRetry={() => void active.refresh()} />
          ) : (
            <EmptyState icon="finance" title={t(`empty.${tab}.title`)} body={t(`empty.${tab}.body`)} />
          )
        }
        ListFooterComponent={active.loadingMore ? <Loading /> : !active.hasMore && active.items.length > 8 ? <Text style={[type.small, styles.end]}>{t('endOfList')}</Text> : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.page, paddingBottom: space.xxl },
  header: { paddingTop: space.sm, paddingBottom: space.xs, gap: space.lg },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  balance: { fontVariant: ['tabular-nums'] },
  addButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  end: { textAlign: 'center', paddingVertical: space.lg },
});
