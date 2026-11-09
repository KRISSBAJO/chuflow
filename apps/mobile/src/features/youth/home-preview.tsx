import { Stack } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ErrorState, ListRow, Loading, Notice, Screen, Section, Segmented } from '@/components/ui';
import { toast } from '@/components/toast';
import { colors, fonts, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const tabs = ['home', 'events', 'journey', 'serve'] as const;
type Event = { id: string; name: string; date: string; endDate?: string; venue?: string; registrationUrl?: string;
  state?: 'active' | 'pending' | 'declined' | 'withdrawn' };
type Preview = {
  branch: string;
  groups: { id: string; name: string; program: string }[];
  events: Event[];
  tracks: { id: string; title: string; groupId: string; milestones?: string[]; completed?: number[] }[];
  projects: { id: string; title: string; groupId: string; date?: string; location?: string; signedUp?: boolean }[];
};

export function YouthHomePreview({ participant = false }: { participant?: boolean } = {}) {
  const t = useT('youth.participantHome');
  const format = useAppFormat();
  const [tab, setTab] = useState<(typeof tabs)[number]>('home');
  const { signOut } = useSession();
  const [busy, setBusy] = useState<string>();
  const result = useApi<Preview>(participant ? '/youth-participant/home' : '/youth/home-preview');
  const { reload } = result;
  useEffect(() => {
    if (!participant) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void reload();
    });
    return () => subscription.remove();
  }, [participant, reload]);
  const preview = result.data;
  const next = preview?.events[0];
  const eventDetails = (event: Event) => {
    const dates = event.endDate && event.endDate !== event.date
      ? format.date(event.date) + ' – ' + format.date(event.endDate) : format.date(event.date);
    return [dates, event.venue].filter(Boolean).join(' · ');
  };

  return (
    <Screen safeTop={participant} refreshing={result.refreshing} onRefresh={() => void result.refresh()}>
      <Stack.Screen options={{ title: t('title') }} />
      {result.loading ? <Loading /> : result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : preview ? <>
        {!participant ? <Notice>{t('previewNote')}</Notice> : null}
        <View style={styles.hero}>
          <Text style={styles.branch}>{preview.branch}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t('headline')}</Text>
          <Text style={styles.subhead}>{t('subtitle')}</Text>
        </View>
        <Segmented options={tabs.map(value => ({ value, label: t(value) }))} value={tab} onChange={setTab} />
        {tab === 'home' ? <View>
          <Section title={t('nextUp')} />
          {next ? <ListRow title={next.name} subtitle={eventDetails(next)} onPress={() => setTab('events')} divider />
            : <EmptyState title={t('noEvents')} />}
          <Section title={t('groups')} />
          {preview.groups.length ? preview.groups.map(group => <ListRow key={group.id} title={group.name} subtitle={group.program} divider />)
            : <EmptyState title={t('noGroups')} />}
        </View> : null}
        {tab === 'events' ? <View>
          <Section title={t('upcoming')} />
          {preview.events.length ? preview.events.map(event => <View key={event.id} style={styles.track}>
            <Text style={type.title}>{event.name}</Text><Text style={type.small}>{eventDetails(event)}</Text>
            {event.state ? <Text style={type.body}>{t(`registration.${event.state}`)}</Text> : null}
            {event.registrationUrl ? <Button variant="secondary" label={t('rsvp')} onPress={() => {
              if (event.registrationUrl) void openBrowserAsync(event.registrationUrl).then(() => reload()).catch(() => toast.error(t('actionFailed')));
            }} /> : null}
          </View>)
            : <EmptyState title={t('noEvents')} />}
        </View> : null}
        {tab === 'journey' ? <View>
          <Section title={t('tracks')} />
          {preview.tracks.length ? preview.tracks.map(track => <View key={track.id} style={styles.track}>
            <Text style={type.title}>{track.title}</Text>
            <Text style={type.small}>{preview.groups.find(group => group.id === track.groupId)?.name}</Text>
            {participant ? <Text style={type.body}>{t('progress', { done: track.completed?.length ?? 0, total: track.milestones?.length ?? 0 })}</Text> : null}
            {track.milestones?.map((milestone, index) => <Text key={milestone} style={type.body}>
              {track.completed?.includes(index) ? '✓' : format.number(index + 1) + '.'} {milestone}
            </Text>)}
          </View>) : <EmptyState title={t('noTracks')} />}
        </View> : null}
        {tab === 'serve' ? <View>
          <Section title={t('projects')} />
          {preview.projects.length ? preview.projects.map(project => <View key={project.id} style={styles.track}>
            <Text style={type.title}>{project.title}</Text>
            <Text style={type.small}>{[format.date(project.date), project.location].filter(Boolean).join(' · ')}</Text>
            {participant ? <Button variant="secondary" label={t(project.signedUp ? 'signedUp' : 'signUp')} disabled={project.signedUp || !!busy}
              loading={busy === project.id} onPress={async () => {
                setBusy(project.id);
                try {
                  await api.post('/youth-participant/projects/' + project.id + '/signup', {});
                  result.setData(current => current && { ...current, projects: current.projects.map(item =>
                    item.id === project.id ? { ...item, signedUp: true } : item) });
                } catch { toast.error(t('actionFailed')); }
                finally { setBusy(undefined); }
              }} /> : null}
          </View>)
            : <EmptyState title={t('noProjects')} />}
        </View> : null}
      </> : null}
      {participant ? <Button variant="secondary" label={t('signOut')} onPress={() => void signOut()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#252451', padding: 24, borderRadius: 24, gap: 8 },
  branch: { ...type.label, color: '#e2fbab' },
  title: { color: colors.page, fontFamily: fonts.bold, fontSize: 36, lineHeight: 41 },
  subhead: { ...type.body, color: '#e9e8ff' },
  track: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6, marginBottom: 12 },
});
