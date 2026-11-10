import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateStepper } from '@/components/kit';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { Button, Caption, ErrorState, ListRow, Loading, Screen, ScreenHeader, Section } from '@/components/ui';
import { colors, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api } from '@/lib/api';
import { isoDay } from '@/lib/format';
import { openWorkspaceBrowser } from '@/lib/open-workspace-browser';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';

type Group = { _id: string; name: string; program: string; branchName: string; active: number; pending: number; canOpen: boolean; eventDate?: string; campEndDate?: string };
type Overview = { groups: Group[]; canManage: boolean; canManageEvents?: boolean; canPreviewHome?: boolean };
type Detail = {
  group: { name: string; eventDate?: string };
  date: string;
  people: { _id: string; firstName: string; lastName: string; state: string }[];
  present: string[];
  canRecord: boolean;
  manager: boolean;
};
const ministrySections = [
  { key: 'groups', icon: 'members', empty: 'noGroups', query: '' },
  { key: 'events', icon: 'calendar', empty: 'noEvents', query: '?view=events' },
  { key: 'camps', icon: 'mapPin', empty: 'noCamps', query: '?view=camps' },
] as const;
type MinistrySection = (typeof ministrySections)[number];

export function YouthOverview({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useT('youth');
  const format = useAppFormat();
  const { user } = useSession();
  const data = useApi<Overview>('/youth');
  const [section, setSection] = useState<MinistrySection>(ministrySections[0]);
  const overview = data.data;
  const groups = overview?.groups ?? [];
  const sectionFor = (group: Group) => group.campEndDate ? 'camps' : group.eventDate ? 'events' : 'groups';
  const rows = groups.filter(group => sectionFor(group) === section.key);
  const canManage = overview?.canManage || overview?.canManageEvents;
  const manageQuery = section.key === 'groups' && !overview?.canManage ? '?view=events' : section.query;
  const openGroup = (group: Group) => {
    if (group.campEndDate) void openWorkspaceBrowser('/youth/camps/' + group._id, user?.workspace);
    else router.push(('/youth/' + group._id) as Href);
  };
  return (
    <Screen safeTop={embedded} refreshing={data.refreshing} onRefresh={() => void data.refresh()}>
      {embedded ? <ScreenHeader title={t('title')} /> : <Stack.Screen options={{ title: t('title') }} />}
      {data.loading ? <Loading /> : data.error ? <ErrorState message={data.error} onRetry={() => void data.refresh()} /> : overview ? <>
        {overview.canPreviewHome ? <Pressable accessibilityRole="button" accessibilityLabel={t('participantHome.open')}
          onPress={() => router.push('/youth/home-preview' as Href)}
          style={({ pressed }) => [hubStyles.previewCard, pressed && hubStyles.pressed]}>
          <Image source={require('../../../assets/images/youth-belonging.webp')} contentFit="cover" style={hubStyles.thumbnail} accessible={false} />
          <View style={hubStyles.copy}>
            <Text style={type.title}>{t('participantHome.open')}</Text>
            <Text style={type.small}>{t('hub.previewHint')}</Text>
          </View>
          <Icon name="arrowRight" color="#974020" size={20} />
        </Pressable> : null}
        <View style={hubStyles.tabs}>
          {ministrySections.map(item => {
            const selected = item.key === section.key;
            const label = t(item.key === 'camps' ? 'hub.camps' : item.key);
            return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSection(item)}
              style={[hubStyles.tab, selected && hubStyles.activeTab]}>
              <Text style={[type.label, hubStyles.tabLabel, selected && hubStyles.activeTabLabel]}>{label}</Text>
            </Pressable>;
          })}
        </View>
        <View style={hubStyles.list}>
          {rows.length ? rows.map(group => {
            const details = [group.branchName, group.eventDate ? format.date(group.eventDate) : undefined].filter(Boolean).join(' · ');
            const content = <>
              <View style={hubStyles.iconTile}><Icon name={section.icon} color="#624187" size={21} /></View>
              <View style={hubStyles.copy}>
                <Text style={type.title}>{group.name}</Text>
                {details ? <Text style={type.small}>{details}</Text> : null}
                <Text style={type.small}>{t('counts', { active: format.number(group.active), pending: format.number(group.pending) })}</Text>
              </View>
              {group.canOpen ? <Icon name="chevronRight" size={18} color={colors.muted} /> : null}
            </>;
            return group.canOpen ? <Pressable key={group._id} accessibilityRole="button" onPress={() => openGroup(group)}
              style={({ pressed }) => [hubStyles.row, pressed && hubStyles.pressed]}>{content}</Pressable> :
              <View key={group._id} style={hubStyles.row}>{content}</View>;
          }) : <View style={hubStyles.empty}>
            <Icon name={section.icon} color={colors.muted} size={20} />
            <Text style={[type.small, hubStyles.copy]}>{t(section.empty)}</Text>
          </View>}
        </View>
        {canManage ? <Button variant="ghost" size="sm" icon="arrowUpRight" label={t('manageWeb')}
          onPress={() => void openWorkspaceBrowser('/youth' + manageQuery, user?.workspace)} /> : null}
      </> : null}
    </Screen>
  );
}

const hubStyles = StyleSheet.create({
  previewCard: { backgroundColor: '#fff7ec', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 76, height: 78, borderRadius: 13 },
  copy: { flex: 1, gap: 3 },
  pressed: { opacity: 0.74 },
  tabs: { flexDirection: 'row', gap: 5, padding: 4, backgroundColor: colors.surface, borderRadius: 16 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 4 },
  activeTab: { backgroundColor: colors.ink },
  tabLabel: { textAlign: 'center' },
  activeTabLabel: { color: colors.page },
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70, padding: 13, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: 17 },
  iconTile: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#f4effa' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, backgroundColor: colors.surface },
});

export function YouthAttendance() {
  const t = useT('youth');
  const format = useAppFormat();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [date, setDate] = useState(() => new Date());
  const [busy, setBusy] = useState<string | null>(null);
  const day = isoDay(date);
  const path = '/youth/groups/' + encodeURIComponent(id ?? '');
  const result = useApi<Detail>(id ? path + '?view=attendance&date=' + day : null);
  const detail = result.data && (result.data.group.eventDate || result.data.date === day) ? result.data : undefined;
  const present = new Set(detail?.present);
  const approved = detail?.people.filter(person => person.state === 'active') ?? [];
  const webGroup = '/youth/' + encodeURIComponent(id ?? '');

  async function mark(enrollmentId: string, attended: boolean) {
    if (busy || !detail) return;
    setBusy(enrollmentId);
    try {
      await api.patch(path + '/attendance', { date: detail.date, enrollmentId, present: attended });
      await result.reload();
    } catch {
      toast.error(t('failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen safeTop={false} refreshing={result.refreshing} onRefresh={() => void result.refresh()}>
      <Stack.Screen options={{ title: result.data?.group.name ?? t('attendance') }} />
      <View style={attendanceStyles.section}>
        <Caption>{t('sessionDate')}</Caption>
        {detail?.group.eventDate ? <Text style={type.label}>{format.longDate(detail.group.eventDate)}</Text> :
          <DateStepper label={format.longDate(date)} value={date} max={new Date()} onChange={setDate} />}
      </View>
      {result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : !detail ? <Loading /> : (
        <View style={attendanceStyles.section}>
          <Section title={t('attendance')} />
          {!detail.canRecord || !approved.length ? <View style={attendanceStyles.setup}>
            <View style={attendanceStyles.setupTitle}>
              <Icon name="check" color={colors.ink} size={20} />
              <Text accessibilityRole="header" style={[type.title, attendanceStyles.copy]}>{t('attendanceSetup.title')}</Text>
            </View>
            {!detail.canRecord ? <>
              <Text style={type.body}>{t('needsLeader')}</Text>
              {detail.manager ? <Button size="sm" variant="secondary" icon="arrowUpRight" label={t('attendanceSetup.assign')}
                onPress={() => void openWorkspaceBrowser(webGroup + '#youth-leader', user?.workspace)} /> : null}
            </> : null}
            {!approved.length ? <>
              <Text style={type.body}>{t('noPeople')}</Text>
              {detail.manager ? <Button size="sm" variant="secondary" icon="arrowUpRight" label={t('attendanceSetup.review')}
                onPress={() => void openWorkspaceBrowser(webGroup + '#youth-participants', user?.workspace)} /> : null}
            </> : null}
          </View> : null}
          {approved.length ? <Caption>{t('presentCount', { count: detail.present.length })}</Caption> : null}
          {approved.map(person => (
            <ListRow key={person._id} title={format.fullName(person)} divider
              right={<Button size="sm" variant={present.has(person._id) ? 'primary' : 'secondary'} label={t(present.has(person._id) ? 'present' : 'markPresent')}
                disabled={!!busy || !detail.canRecord || Boolean(detail.group.eventDate && detail.date > day)} loading={busy === person._id} onPress={() => void mark(person._id, !present.has(person._id))} />} />
          ))}
        </View>
      )}
      {detail && (detail.manager || !detail.group.eventDate) ? <View style={attendanceStyles.section}>
        <Section title={t('attendanceSetup.groupTools')} />
        {!detail.group.eventDate ? <ListRow title={t('development')} onPress={() => void openWorkspaceBrowser(webGroup + '/development', user?.workspace)} /> : null}
        {detail.manager ? <ListRow title={t('manageWeb')} onPress={() => void openWorkspaceBrowser(webGroup, user?.workspace)} /> : null}
      </View> : null}
    </Screen>
  );
}

const attendanceStyles = StyleSheet.create({
  section: { gap: 8 },
  setup: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 10 },
  setupTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1 },
});
