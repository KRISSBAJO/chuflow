import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Caption, ListRow, Section, Segmented } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { MiniBar, SubHeading } from './bars';
import type { DashboardBranchAlert, DashboardGrowthBranch, DashboardOverview } from './types';

/*
 * The network-level blocks of the website dashboard (watchlist and branch health), as compact
 * lists. Shown to executive roles only.
 */

type Executive = NonNullable<DashboardOverview['executive']>;

const SHOW = 4;

function place(item: DashboardBranchAlert) {
  return [item.district, [item.city, item.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

export function Watchlist({ executive }: { executive: Executive }) {
  const t = useT('home.watchlist');
  const format = useAppFormat();
  const missing = executive.branchesWithoutRecentAttendance;
  const backlog = executive.highFollowUpBacklog;
  const maxBacklog = Math.max(1, ...backlog.map((item) => item.pendingFollowUp ?? 0));

  return (
    <View>
      <Section title={t('title')} />

      <SubHeading title={t('noRecentAttendance')} count={missing.length} />
      {missing.length ? (
        missing.slice(0, SHOW).map((item, index) => (
          <ListRow
            key={item._id}
            divider={index > 0}
            title={item.name}
            subtitle={place(item)}
            right={<Caption>{item.lastSubmittedAt ? t('last', { when: format.relativeTime(item.lastSubmittedAt) }) : t('neverReported')}</Caption>}
          />
        ))
      ) : (
        <Caption style={styles.quiet}>{t('allReported')}</Caption>
      )}

      <SubHeading title={t('backlog')} count={backlog.length} />
      {backlog.length ? (
        backlog.slice(0, SHOW).map((item, index) => (
          <ListRow
            key={item._id}
            divider={index > 0}
            title={item.name}
            subtitle={place(item)}
            right={
              <View accessibilityLabel={t('pending', { count: item.pendingFollowUp ?? 0 })}>
                <MiniBar value={item.pendingFollowUp ?? 0} max={maxBacklog} />
              </View>
            }
          />
        ))
      ) : (
        <Caption style={styles.quiet}>{t('noBacklog')}</Caption>
      )}
    </View>
  );
}

type HealthTab = 'leaders' | 'attention';

export function BranchHealth({ leaders, attention }: { leaders: DashboardGrowthBranch[]; attention: DashboardGrowthBranch[] }) {
  const t = useT('home.health');
  const format = useAppFormat();
  const [tab, setTab] = useState<HealthTab>('leaders');
  const items = tab === 'leaders' ? leaders : attention;
  const maxScore = Math.max(1, ...items.map((item) => item.growthScore));

  return (
    <View>
      <Section title={t('title')} />
      <View style={{ marginTop: space.sm }}>
        <Segmented<HealthTab>
          options={[
            { value: 'leaders', label: t('leaders') },
            { value: 'attention', label: t('attention') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {items.length ? (
        items.slice(0, SHOW).map((item, index) => (
          <View key={item._id} style={[styles.growthRow, index > 0 && styles.divider]} accessibilityLabel={`${item.name}, ${t('score', { score: item.growthScore })}`}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type.label} numberOfLines={1}>
                {item.name}
              </Text>
              <Caption numberOfLines={1}>{[item.district, item.oversightRegion].filter(Boolean).join(' · ')}</Caption>
              <Caption numberOfLines={1} style={{ color: colors.faint }}>
                {t('detail', {
                  guests: format.number(item.guestsCaptured),
                  members: format.number(item.membersAdded),
                  converts: format.number(item.newConverts),
                })}
              </Caption>
            </View>
            <MiniBar value={item.growthScore} max={maxScore} />
          </View>
        ))
      ) : (
        <Caption style={styles.quiet}>{tab === 'leaders' ? t('noGrowth') : t('noLow')}</Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quiet: { paddingVertical: space.sm },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  rank: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
});
