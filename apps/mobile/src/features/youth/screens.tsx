import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DateStepper } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, EmptyState, ErrorState, ListRow, Loading, Notice, Screen, ScreenHeader, Section } from '@/components/ui';
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

export function YouthOverview({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useT('youth');
  const { user } = useSession();
  const data = useApi<Overview>('/youth');
  const groups = data.data?.groups ?? [];
  return (
    <Screen safeTop={embedded} refreshing={data.refreshing} onRefresh={() => void data.refresh()}>
      {embedded ? <ScreenHeader title={t('title')} /> : <Stack.Screen options={{ title: t('title') }} />}
      {data.data?.canPreviewHome ? <Button variant="secondary" label={t('participantHome.open')}
        onPress={() => router.push('/youth/home-preview' as Href)} /> : null}
      {data.loading ? <Loading /> : data.error ? <ErrorState message={data.error} onRetry={() => void data.refresh()} /> : (
        <View>
          {(['groups', 'events', 'camps'] as const).map(section => {
            const rows = groups.filter(group => (group.campEndDate ? 'camps' : group.eventDate ? 'events' : 'groups') === section);
            return (
              <View key={section}>
                <Section title={t(section)} />
                {rows.length ? rows.map(group => (
                  <ListRow key={group._id} title={group.name} subtitle={`${group.branchName} · ${t('counts', { active: group.active, pending: group.pending })}`}
                    onPress={group.canOpen ? () => group.campEndDate ?
                      void openWorkspaceBrowser('/youth/camps/' + group._id, user?.workspace) :
                      router.push(('/youth/' + group._id) as Href) : undefined} divider />
                )) : <EmptyState title={t(section === 'camps' ? 'noCamps' : section === 'events' ? 'noEvents' : 'noGroups')} />}
              </View>
            );
          })}
        </View>
      )}
      {data.data?.canManage || data.data?.canManageEvents ? <Button variant="secondary" label={t('manageWeb')}
        onPress={() => void openWorkspaceBrowser(data.data?.canManage ? '/youth' : '/youth?view=events', user?.workspace)} /> : null}
    </Screen>
  );
}

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
      {detail?.group.eventDate ? <Caption>{format.shortDate(new Date(detail.group.eventDate + 'T12:00:00'))}</Caption> :
        <DateStepper label={t('sessionDate')} value={date} max={new Date()} onChange={setDate} />}
      {result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : !detail ? <Loading /> : (
        <View>
          <Section title={t('attendance')} />
          <Caption>{t('presentCount', { count: detail.present.length })}</Caption>
          {!detail.canRecord ? <Notice tone="warning">{t('needsLeader')}</Notice> : null}
          {detail.people.some(person => person.state === 'active') ? detail.people.filter(person => person.state === 'active').map(person => (
            <ListRow key={person._id} title={format.fullName(person)} divider
              right={<Button size="sm" variant={present.has(person._id) ? 'primary' : 'secondary'} label={t(present.has(person._id) ? 'present' : 'markPresent')}
                disabled={!!busy || !detail.canRecord || Boolean(detail.group.eventDate && detail.date > day)} loading={busy === person._id} onPress={() => void mark(person._id, !present.has(person._id))} />} />
          )) : <EmptyState title={t('noPeople')} />}
        </View>
      )}
      {detail?.manager ? <Button variant="secondary" label={t('manageWeb')} onPress={() => void openWorkspaceBrowser('/youth/' + id, user?.workspace)} /> : null}
      {detail && !detail.group.eventDate ? <Button variant="secondary" label={t('development')}
        onPress={() => void openWorkspaceBrowser('/youth/' + encodeURIComponent(id) + '/development', user?.workspace)} /> : null}
    </Screen>
  );
}
