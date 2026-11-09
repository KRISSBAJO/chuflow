import { Stack } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, Loading, Screen } from '@/components/ui';
import { Icon } from '@/components/icon';
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
  const track = preview?.tracks.find(item => (item.completed?.length ?? 0) < (item.milestones?.length ?? 0));
  const project = preview?.projects.find(item => !item.signedUp);
  const featured = next ? { tab: 'events', icon: 'calendar', title: next.name, detail: eventDetails(next) } as const :
    track ? { tab: 'journey', icon: 'book', title: track.title, detail: t('tracks') } as const :
    project ? { tab: 'serve', icon: 'care', title: project.title, detail: [format.date(project.date), project.location].filter(Boolean).join(' · ') } as const : null;

  return (
    <Screen safeTop={participant} refreshing={result.refreshing} onRefresh={() => void result.refresh()}>
      <Stack.Screen options={{ title: t('title') }} />
      {result.loading ? <Loading /> : result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : preview ? <>
        <View style={styles.masthead}>
          <View style={styles.mastheadCopy}>
            <View style={styles.meta}>
              <Icon name="mapPin" size={15} color="#974020" />
              <Text style={styles.branch}>{preview.branch}</Text>
              {!participant ? <Text style={styles.preview} accessibilityLabel={t('previewNote')}>{t('previewBadge')}</Text> : null}
            </View>
            <Text accessibilityRole="header" style={styles.title}>{t('welcomeTitle')}</Text>
            <Text style={styles.subhead}>{t('welcomeSubtitle')}</Text>
          </View>
          <View style={styles.mark} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Icon name="sparkle" size={29} color="#974020" />
          </View>
        </View>
        <View style={styles.tabs}>
          {tabs.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.selectedTab]}>
            <Text style={[styles.tabLabel, tab === value && styles.selectedLabel]}>{t(value)}</Text>
          </Pressable>)}
        </View>
        {tab === 'home' ? <View style={styles.sections}>
          {featured ? <Pressable accessibilityRole="button" onPress={() => setTab(featured.tab)}
            style={({ pressed }) => [styles.feature, pressed && styles.pressed]}>
            <View style={styles.featureCopy}>
              <Text style={styles.eyebrow}>{t('nextUp')}</Text>
              <Text style={styles.featureTitle}>{featured.title}</Text>
              {featured.detail ? <Text style={type.small}>{featured.detail}</Text> : null}
            </View>
            <View style={styles.featureIcon}><Icon name={featured.icon} color="#974020" /></View>
          </Pressable> : null}
          <View style={styles.sections}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('groups')}</Text>
            {preview.groups.length ? preview.groups.map(group => <View key={group.id} style={styles.group}>
              <View style={styles.groupIcon}><Icon name="members" size={19} color="#674b87" /></View>
              <View style={styles.featureCopy}>
                <Text style={type.title}>{group.name}</Text>
                {group.name.trim().toLowerCase() !== group.program.trim().toLowerCase() ? <Text style={type.small}>{group.program}</Text> : null}
              </View>
            </View>) : <Text style={styles.empty}>{t('noGroups')}</Text>}
          </View>
          {!featured ? <Pressable accessibilityRole="button" onPress={() => setTab('events')}
            style={({ pressed }) => [styles.calendarNote, pressed && styles.pressed]}>
            <Icon name="calendar" size={19} color={colors.muted} />
            <Text style={styles.calendarText}>{t('calendarQuiet')}</Text>
            <Icon name="chevronRight" size={17} color={colors.muted} />
          </Pressable> : null}
        </View> : null}
        {tab === 'events' ? <View style={styles.sections}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('upcoming')}</Text>
          {preview.events.length ? preview.events.map(event => <View key={event.id} style={styles.track}>
            <Text style={type.title}>{event.name}</Text><Text style={type.small}>{eventDetails(event)}</Text>
            {event.state ? <Text style={type.body}>{t(`registration.${event.state}`)}</Text> : null}
            {event.registrationUrl ? <Button variant="secondary" label={t('rsvp')} onPress={() => {
              if (event.registrationUrl) void openBrowserAsync(event.registrationUrl).then(() => reload()).catch(() => toast.error(t('actionFailed')));
            }} /> : null}
          </View>)
            : <Text style={styles.empty}>{t('noEvents')}</Text>}
        </View> : null}
        {tab === 'journey' ? <View style={styles.sections}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('tracks')}</Text>
          {preview.tracks.length ? preview.tracks.map(track => <View key={track.id} style={styles.track}>
            <Text style={type.title}>{track.title}</Text>
            <Text style={type.small}>{preview.groups.find(group => group.id === track.groupId)?.name}</Text>
            {participant ? <Text style={type.body}>{t('progress', { done: track.completed?.length ?? 0, total: track.milestones?.length ?? 0 })}</Text> : null}
            {track.milestones?.map((milestone, index) => <Text key={milestone} style={type.body}>
              {track.completed?.includes(index) ? '✓' : format.number(index + 1) + '.'} {milestone}
            </Text>)}
          </View>) : <Text style={styles.empty}>{t('noTracks')}</Text>}
        </View> : null}
        {tab === 'serve' ? <View style={styles.sections}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('projects')}</Text>
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
            : <Text style={styles.empty}>{t('noProjects')}</Text>}
        </View> : null}
      </> : null}
      {participant ? <Button variant="secondary" label={t('signOut')} onPress={() => void signOut()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  mastheadCopy: { flex: 1, gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  branch: { ...type.label, color: '#974020' },
  preview: { ...type.small, backgroundColor: colors.surfaceStrong, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 32, lineHeight: 37, letterSpacing: -0.9 },
  subhead: type.body,
  mark: { width: 55, height: 55, borderRadius: 20, backgroundColor: colors.flameSoft, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 5, backgroundColor: colors.surface, borderRadius: 17 },
  tab: { flexGrow: 1, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  selectedTab: { backgroundColor: colors.ink },
  tabLabel: type.label,
  selectedLabel: { color: colors.page },
  sections: { gap: 10 },
  sectionTitle: { ...type.title, fontSize: 18, lineHeight: 24 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.flameSoft, borderRadius: 20, padding: 17, marginBottom: 6 },
  featureCopy: { flex: 1, gap: 3 },
  eyebrow: { ...type.micro, color: '#974020' },
  featureTitle: { ...type.display, fontSize: 20, lineHeight: 25 },
  featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.hairline },
  groupIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#f4effa', alignItems: 'center', justifyContent: 'center' },
  calendarNote: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderRadius: 14, padding: 12, backgroundColor: colors.surface },
  calendarText: { ...type.small, flex: 1 },
  empty: { ...type.small, padding: 15, backgroundColor: colors.surface, borderRadius: 14 },
  pressed: { opacity: 0.74 },
  track: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6 },
});
