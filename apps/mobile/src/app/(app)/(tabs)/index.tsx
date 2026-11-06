import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HomeHero } from '@/components/home-hero';
import { Icon, type IconName } from '@/components/icon';
import { Avatar, Caption, EmptyState, ErrorState, ListRow, Notice, Screen, Section, tap } from '@/components/ui';
import { colors, fonts, space } from '@/constants/theme';
import { useAlerts } from '@/lib/alerts';
import { fullName, greeting, relativeTime } from '@/lib/format';
import { routeForAlert } from '@/lib/notifications';
import { useOnline } from '@/lib/offline-queue';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { DashboardOverview } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const ALERT_DOT: Record<string, string> = { critical: '#ef4444', warm: '#f59e0b', cool: '#0ea5e9' };

export default function HomeScreen() {
  const { user } = useSession();
  const { summary, refresh: refreshAlerts } = useAlerts();
  const online = useOnline();
  const days = user?.preferences?.defaultReportDays ?? 30;
  const dashboard = useApi<DashboardOverview>(`/reports/dashboard?days=${days}`);
  const role = user?.role;

  const shortcuts: { label: string; icon: IconName; href: Href; show: boolean }[] = [
    { label: 'New guest', icon: 'plus', href: '/guest/new', show: true },
    { label: 'Attendance', icon: 'attendance', href: '/attendance', show: can.attendance(role) },
    { label: 'Follow-up', icon: 'care', href: '/follow-up', show: can.followUp(role) },
    { label: 'Approvals', icon: 'approvals', href: '/approvals', show: can.approvals(role) },
  ];

  const metrics = dashboard.data?.metrics;
  const recent = dashboard.data?.operational?.recentGuests ?? [];
  const needsYou = summary?.items ?? [];
  const [today] = useState(() => new Date());

  return (
    <Screen
      refreshing={dashboard.refreshing}
      onRefresh={() => {
        void dashboard.refresh();
        void refreshAlerts();
      }}
      contentStyle={{ gap: space.xl }}
    >
      <HomeHero
        date={today}
        greeting={greeting(today)}
        name={user?.firstName ?? 'friend'}
        scope={[dashboard.data?.scope.label, `Last ${days} days`].filter(Boolean).join(' · ')}
        alerts={summary?.quickStats.activeAlerts ?? 0}
        onAlerts={() => router.push('/approvals')}
        metrics={[
          { label: 'Guests', value: metrics?.totalGuests, onPress: () => router.push('/guests') },
          { label: 'Attendance', value: metrics?.totalAttendance, onPress: can.attendance(role) ? () => router.push('/attendance') : undefined },
          { label: 'Members', value: metrics?.totalMembers },
          { label: 'Follow-up', value: metrics?.pendingFollowUp, onPress: can.followUp(role) ? () => router.push('/follow-up') : undefined },
        ]}
      />

      {!online ? (
        <Notice tone="warning" icon="cloudOff">
          You&apos;re offline. Attendance you count is saved and sent later.
        </Notice>
      ) : null}

      {dashboard.error && !metrics ? <ErrorState message={dashboard.error} onRetry={() => void dashboard.refresh()} /> : null}

      <View style={styles.shortcuts}>
        {shortcuts
          .filter((shortcut) => shortcut.show)
          .map((shortcut, index) => (
            <Pressable
              key={shortcut.label}
              accessibilityRole="button"
              onPress={() => {
                tap();
                router.push(shortcut.href);
              }}
              style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.shortcutIcon, index === 0 && styles.shortcutPrimary]}>
                <Icon name={shortcut.icon} size={18} color={index === 0 ? '#ffffff' : colors.ink} strokeWidth={index === 0 ? 2.2 : 1.8} />
              </View>
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {shortcut.label}
              </Text>
            </Pressable>
          ))}
      </View>

      <View>
        <Section title="Needs you" />
        {needsYou.length ? (
          needsYou.slice(0, 4).map((item, index) => (
            <ListRow
              key={item.key}
              divider={index > 0}
              title={`${item.count} ${item.label.toLowerCase()}`}
              subtitle={item.description}
              left={<View style={[styles.alertDot, { backgroundColor: ALERT_DOT[item.tone] ?? colors.faint }]} />}
              onPress={() => router.push(routeForAlert(item.href))}
            />
          ))
        ) : (
          <View style={styles.caughtUp}>
            <Icon name="check" size={15} color={colors.success} strokeWidth={2.2} />
            <Caption>You&apos;re all caught up.</Caption>
          </View>
        )}
      </View>

      <View>
        <Section title="Recent guests" action={recent.length ? 'See all' : undefined} onAction={() => router.push('/guests')} />
        {recent.length ? (
          recent.slice(0, 5).map((guest, index) => (
            <ListRow
              key={guest._id}
              divider={index > 0}
              title={fullName(guest)}
              left={<Avatar person={guest} size={30} />}
              right={<Caption>{relativeTime(guest.createdAt)}</Caption>}
              chevron={false}
              onPress={() => router.push(`/guest/${guest._id}`)}
            />
          ))
        ) : dashboard.loading ? null : (
          <EmptyState icon="guests" title="No guests yet" body="New guests you register show up here." />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: 'row' },
  shortcut: { flex: 1, alignItems: 'center', gap: 6 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shortcutPrimary: { backgroundColor: colors.ink },
  shortcutLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  alertDot: { width: 7, height: 7, borderRadius: 4, marginHorizontal: 2 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
});
