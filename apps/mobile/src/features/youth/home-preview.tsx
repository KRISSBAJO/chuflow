import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, ErrorState, Field, Loading, Screen } from '@/components/ui';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { colors, fonts, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { useApi } from '@/lib/use-api';
import { api, getApiSession } from '@/lib/api';
import { useSession, userId } from '@/lib/session';
import { isoDay } from '@/lib/format';
import { YouthNavigation, type YouthTab } from './youth-navigation';
import { YouthGroupChat } from './group-chat';
import { useYouthDesign } from './dashboard-design';

type Event = { id: string; name: string; date: string; endDate?: string; venue?: string; registrationUrl?: string;
  state?: 'active' | 'pending' | 'declined' | 'withdrawn' };
type YouthPost = { _id: string; groupId: string; kind: 'update' | 'devotional' | 'program' | 'poll'; title: string; body: string; createdAt: string;
  sunday?: string; scripture?: string; question?: string; resourceUrl?: string; resourceFileName?: string; pollOptions?: string[]; pollClosedAt?: string };
type PollState = { selected?: number; counts?: number[] };
type Preview = {
  branch: string;
  groups: { id: string; name: string; program: string }[];
  events: Event[];
  tracks: { id: string; title: string; groupId: string; milestones?: string[]; completed?: number[] }[];
  projects: { id: string; title: string; groupId: string; date?: string; location?: string; signedUp?: boolean }[];
  posts?: YouthPost[];
  programReplies?: string[];
  chatEnabled?: boolean;
  pollStates?: Record<string, PollState>;
  serviceHistory?: { id: string; title: string; date?: string; minutes: number }[];
  mentoringReminder?: { date: string; nextStep?: string };
};

function SundayProgram({ post, participant, replied, onReply }: {
  post: YouthPost; participant: boolean; replied: boolean; onReply: () => void;
}) {
  const t = useT('youth.participantHome.programs');
  const format = useAppFormat();
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  return <View style={styles.track}>
    <Text style={styles.eyebrow}>{format.date(post.sunday)}</Text>
    <Text style={styles.featureTitle}>{post.title}</Text>
    {post.scripture ? <Text style={type.label}>{post.scripture}</Text> : null}
    <Text style={type.body}>{post.body}</Text>
    {post.resourceUrl?.startsWith('https://') ? <Button variant="secondary" size="sm" icon="arrowUpRight" label={t('resource')}
      onPress={() => { if (post.resourceUrl) void openBrowserAsync(post.resourceUrl).catch(() => toast.error(t('failed'))); }} /> : null}
    {post.resourceFileName ? <>
      <Text style={type.small}>{post.resourceFileName}</Text>
      {participant ? <Button variant="secondary" size="sm" icon="download" label={t('download')} loading={opening} disabled={opening} onPress={async () => {
        setOpening(true);
        try {
          const session = getApiSession();
          const ticket = await api.post<{ path: string }>('/youth-participant/programs/' + post._id + '/pdf-ticket');
          if (session === getApiSession() && ticket.path.startsWith('/youth-registration/program-pdf/')) {
            await openBrowserAsync(session.apiUrl + ticket.path);
          }
        } catch { toast.error(t('failed')); }
        finally { setOpening(false); }
      }} /> : null}
    </> : null}
    {post.question ? <View style={styles.sections}>
      <Text style={type.title}>{post.question}</Text>
      {participant && (replied ? <Text style={type.small}>{t('received')}</Text> : <>
        <Field label={t('answer')} hint={t('private')} multiline maxLength={800} value={answer} onChangeText={setAnswer} />
        <Button variant="primary" size="sm" label={t('submit')} loading={busy} disabled={busy || !answer.trim()} onPress={async () => {
          setBusy(true);
          try {
            await api.post('/youth-participant/programs/' + post._id + '/response', { answer: answer.trim() });
            onReply();
            setAnswer('');
          } catch { toast.error(t('failed')); }
          finally { setBusy(false); }
        }} />
      </>)}
    </View> : null}
  </View>;
}

function YouthPoll({ post, participant, state, onVote }: {
  post: YouthPost; participant: boolean; state?: PollState; onVote: (option: number) => void;
}) {
  const t = useT('youth.participantHome.polls');
  const format = useAppFormat();
  const [choice, setChoice] = useState<number>();
  const [busy, setBusy] = useState(false);
  const canVote = participant && !post.pollClosedAt && state?.selected === undefined;
  return <View style={styles.track}>
    <Text style={styles.eyebrow}>{t(post.pollClosedAt ? 'closed' : 'open')}</Text>
    <Text style={styles.featureTitle}>{post.title}</Text>
    <Text style={type.body}>{post.body}</Text>
    {post.pollOptions?.map((option, index) => canVote ?
      <Chip key={option} label={option} selected={choice === index} onPress={() => { if (!busy) setChoice(index); }} /> :
      <Text key={option} style={type.body}>
        {option}{state?.selected === index ? ' · ' + t('yourVote') : ''}
        {state?.counts ? ' · ' + format.number(state.counts[index] ?? 0) : ''}
      </Text>)}
    {canVote ? <Button size="sm" label={t('vote')} loading={busy} disabled={busy || choice === undefined} onPress={async () => {
      if (busy || choice === undefined) return;
      setBusy(true);
      try {
        const result = await api.post<{ option: number }>('/youth-participant/polls/' + post._id + '/vote', { option: choice });
        onVote(result.option);
      } catch { toast.error(t('failed')); }
      finally { setBusy(false); }
    }} /> : null}
  </View>;
}

export function YouthHomePreview({ participant = false }: { participant?: boolean } = {}) {
  const { user } = useSession();
  const designKey = JSON.stringify(['youth-design', user?.workspace?.id, userId(user), participant]);
  return <YouthDashboard key={designKey} participant={participant} designKey={designKey} />;
}

function YouthDashboard({ participant, designKey }: { participant: boolean; designKey: string }) {
  const t = useT('youth.participantHome');
  const format = useAppFormat();
  const [tab, setTab] = useState<YouthTab>('home');
  const { signOut } = useSession();
  const design = useYouthDesign(designKey);
  const { palette } = design;
  const [busy, setBusy] = useState<string>();
  const [openPost, setOpenPost] = useState<string>();
  const [showAllPosts, setShowAllPosts] = useState(false);
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
  const posts = preview?.posts?.filter(post => post.kind === 'update' || post.kind === 'devotional') ?? [];
  const polls = preview?.posts?.filter(post => post.kind === 'poll') ?? [];
  const programs = (preview?.posts ?? []).filter(post => post.kind === 'program')
    .sort((a, b) => (b.sunday ?? '').localeCompare(a.sunday ?? ''));
  const today = isoDay(new Date());
  const upcomingPrograms = programs.filter(post => (post.sunday ?? '') >= today).reverse();
  const nextProgram = upcomingPrograms[0] ?? programs[0];
  const openPoll = polls.find(post => !post.pollClosedAt && preview?.pollStates?.[post._id]?.selected === undefined);
  const serviceHistory = preview?.serviceHistory ?? [];
  const reminder = participant ? preview?.mentoringReminder : undefined;
  const mentoringCard = reminder ? <View style={[styles.feature, { backgroundColor: palette.surface }]}>
    <View style={styles.featureCopy}>
      <Text style={[styles.eyebrow, { color: palette.accent }]}>{t('mentoringReminder.title')}</Text>
      <Text style={styles.featureTitle}>{format.date(reminder.date)}</Text>
      {reminder.nextStep ? <Text style={type.body}>{reminder.nextStep}</Text> : null}
    </View>
    <View style={styles.featureIcon}><Icon name="calendar" color={palette.accent} /></View>
  </View> : null;
  const serviceHours = (minutes: number) => format.number(minutes / 60, { maximumFractionDigits: 2 });
  const verifiedMinutes = serviceHistory.reduce((sum, record) => sum + record.minutes, 0);
  const next = preview?.events.find(event => (event.endDate ?? event.date) >= today);
  const eventDetails = (event: Event) => {
    const dates = event.endDate && event.endDate !== event.date
      ? format.date(event.date) + ' – ' + format.date(event.endDate) : format.date(event.date);
    return [dates, event.venue].filter(Boolean).join(' · ');
  };
  const track = preview?.tracks.find(item => (item.completed?.length ?? 0) < (item.milestones?.length ?? 0));
  const featured = next ? { tab: 'events', icon: 'calendar', title: next.name, detail: eventDetails(next) } as const :
    openPoll ? { tab: 'community', icon: 'message', title: openPoll.title, detail: t('polls.open') } as const :
    nextProgram ? { tab: 'community', icon: 'book', title: nextProgram.title,
      detail: [t('programs.title'), format.date(nextProgram.sunday)].filter(Boolean).join(' · ') } as const :
    preview?.groups.length ? { tab: 'community', icon: 'members', title: t('exploreGroups'), detail: participant ? preview.groups[0]?.name : undefined } as const : null;
  const communities = preview && <View style={styles.sections}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{t('groups')}</Text>
    {preview.groups.length ? preview.groups.map(group => {
      const program = upcomingPrograms.find(post => post.groupId === group.id);
      const showProgram = group.name.trim().toLowerCase() !== group.program.trim().toLowerCase();
      return <View key={group.id} style={styles.group}>
        <View style={[styles.groupIcon, { backgroundColor: palette.tint }]}><Icon name="members" size={19} color={palette.accent} /></View>
        <View style={styles.featureCopy}>
          {participant ? <Text style={[styles.eyebrow, { color: palette.accent }]}>{t('yourGroup')}</Text> : null}
          <Text style={type.title}>{group.name}</Text>
          {program ? <Text style={type.small}>{[program.title, format.date(program.sunday)].filter(Boolean).join(' · ')}</Text> :
            showProgram ? <Text style={type.small}>{group.program}</Text> : null}
        </View>
      </View>;
    }) : <Text style={styles.empty}>{t('noGroups')}</Text>}
  </View>;
  return (
    <View style={styles.page}>
    <Screen safeTop={participant} refreshing={result.refreshing} onRefresh={() => void result.refresh()}>
      <Stack.Screen options={{ title: t('title') }} />
      {result.loading ? <Loading /> : result.error ? <ErrorState message={result.error} onRetry={() => void result.refresh()} /> : preview ? <>
        <View style={styles.meta}>
          <Icon name="mapPin" size={15} color={palette.accent} />
          <Text style={[styles.branch, { color: palette.accent }]}>{preview.branch}</Text>
          {!participant ? <Text style={styles.preview} accessibilityLabel={t('previewNote')}>{t('previewBadge')}</Text> : null}
        </View>
        {tab === 'home' ? <View style={styles.sections}>
          <View style={[styles.hero, { backgroundColor: palette.surface }]}>
            <Image source={design.hero.image} style={styles.art} contentFit="cover" contentPosition={design.hero.position}
              accessible={false} />
            <View style={styles.heroCopy}>
              <Text accessibilityRole="header" style={styles.title}>{t('welcomeTitle')}</Text>
              <View style={styles.heroDetails}>
                <Text style={[type.body, styles.heroSubtitle]}>{t('welcomeSubtitle')}</Text>
                {design.open ? <Pressable accessibilityRole="button" onPress={design.open}
                  style={({ pressed }) => [styles.customize, pressed && styles.pressed]}>
                  <Icon name="settings" size={16} color={palette.accent} />
                  <Text style={[type.label, { color: palette.accent }]}>{t('customize')}</Text>
                </Pressable> : null}
              </View>
            </View>
          </View>
          {design.widgets.includes('activity') && featured ? <Pressable accessibilityRole="button" onPress={() => setTab(featured.tab)}
            style={({ pressed }) => [styles.feature, { backgroundColor: palette.surface }, pressed && styles.pressed]}>
            <View style={styles.featureCopy}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>{t('nextUp')}</Text>
              <Text style={styles.featureTitle}>{featured.title}</Text>
              {featured.detail ? <Text style={type.small}>{featured.detail}</Text> : null}
            </View>
            <View style={styles.featureIcon}><Icon name={featured.icon} color={palette.accent} /></View>
            <Icon name="chevronRight" size={16} color={palette.accent} />
          </Pressable> : null}
          {mentoringCard}
          {design.spotlight}
          {design.widgets.includes('journey') && preview.tracks.length ? <Pressable accessibilityRole="button"
            onPress={() => setTab('journey')} style={({ pressed }) => [styles.feature, { backgroundColor: palette.surface }, pressed && styles.pressed]}>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>{t('journey')}</Text>
              {track ? <Text style={type.small}>{track.title}</Text> : null}
            </View>
            <View style={styles.featureIcon}><Icon name="book" color={palette.accent} /></View>
          </Pressable> : null}
          {design.widgets.includes('service') && participant && verifiedMinutes > 0 ? <Pressable accessibilityRole="button"
            onPress={() => setTab('serve')} style={({ pressed }) => [styles.feature, { backgroundColor: palette.surface }, pressed && styles.pressed]}>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>{t('serviceLog.history')}</Text>
              <Text style={type.small}>{t('serviceLog.hours', { hours: serviceHours(verifiedMinutes) })}</Text>
            </View>
            <View style={styles.featureIcon}><Icon name="care" color={palette.accent} /></View>
          </Pressable> : null}
          {design.widgets.includes('updates') && posts.length ? <View style={styles.sections}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('posts.heading')}</Text>
            {(showAllPosts ? posts : posts.slice(0, 3)).map(post => {
              const expanded = openPost === post._id;
              const group = preview.groups.find(item => item.id === post.groupId);
              return <View key={post._id} style={styles.track}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenPost(expanded ? undefined : post._id)}
                  style={styles.postToggle}>
                  <View style={styles.featureCopy}>
                    <Text style={styles.eyebrow}>{t(`posts.${post.kind}`)}</Text>
                    <Text style={type.title}>{post.title}</Text>
                    <Text style={type.small}>{[!participant ? group?.name : undefined, format.date(post.createdAt)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Icon name={expanded ? 'minus' : 'plus'} size={19} color={colors.muted} />
                </Pressable>
                {expanded ? <Text style={type.body}>{post.body}</Text> : null}
              </View>;
            })}
            {posts.length > 3 ? <Button variant="ghost" label={t(showAllPosts ? 'posts.less' : 'posts.more')}
              onPress={() => setShowAllPosts(!showAllPosts)} /> : null}
          </View> : null}
          {design.widgets.includes('groups') ? communities : null}
        </View> : null}
        {tab === 'community' ? <View style={styles.sections}>
          {!nextProgram && !openPoll ? communities : null}
          {participant && preview.chatEnabled ? <YouthGroupChat /> : null}
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('programs.title')}</Text>
          {programs.length ? programs.map(post => <SundayProgram key={post._id} post={post} participant={participant}
            replied={preview.programReplies?.includes(post._id) ?? false}
            onReply={() => result.setData(current => current && { ...current, programReplies: [...(current.programReplies ?? []), post._id] })} />) :
            <Text style={styles.empty}>{t('programs.empty')}</Text>}
          {polls.length ? <Text accessibilityRole="header" style={styles.sectionTitle}>{t('polls.title')}</Text> : null}
          {polls.map(post => <YouthPoll key={post._id} post={post} participant={participant} state={preview.pollStates?.[post._id]}
            onVote={option => result.setData(current => current && { ...current,
              pollStates: { ...current.pollStates, [post._id]: { ...current.pollStates?.[post._id], selected: option } } })} />)}
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
          {mentoringCard}
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t('tracks')}</Text>
          {preview.tracks.length ? preview.tracks.map(track => <View key={track.id} style={styles.track}>
            <Text style={type.title}>{track.title}</Text>
            <Text style={type.small}>{preview.groups.find(group => group.id === track.groupId)?.name}</Text>
            {participant && track.milestones?.length && track.milestones.every((_, index) => track.completed?.includes(index)) ?
              <Text style={styles.eyebrow}>{t('serviceLog.trackComplete')}</Text> :
              participant ? <Text style={type.body}>{t('progress', { done: track.completed?.length ?? 0, total: track.milestones?.length ?? 0 })}</Text> : null}
            {track.milestones?.map((milestone, index) => <Text key={milestone} style={type.body}>
              {track.completed?.includes(index) ? '✓' : format.number(index + 1) + '.'} {milestone}
            </Text>)}
          </View>) : <Text style={styles.empty}>{t('noTracks')}</Text>}
        </View> : null}
        {tab === 'serve' ? <View style={styles.sections}>
          {participant && serviceHistory.length ? <View style={styles.sections}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>{t('serviceLog.history')}</Text>
            <View style={styles.track}>
              <Text style={styles.featureTitle}>{t('serviceLog.hours', { hours: serviceHours(verifiedMinutes) })}</Text>
              {serviceHistory.map(record => <View key={record.id} style={styles.serviceRecord}>
                <View style={styles.featureCopy}>
                  <Text style={type.title}>{record.title}</Text>
                  {record.date ? <Text style={type.small}>{format.date(record.date)}</Text> : null}
                </View>
                <Text style={type.small}>{t('serviceLog.hours', { hours: serviceHours(record.minutes) })}</Text>
              </View>)}
            </View>
          </View> : null}
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
      {design.panel}
    </Screen>
    {preview && !result.error ? <YouthNavigation tab={tab} onChange={setTab} accent={palette.accent} tint={palette.tint} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  branch: { ...type.label, color: '#974020' },
  preview: { ...type.small, backgroundColor: colors.surfaceStrong, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff7ec', marginBottom: 6 },
  art: { width: '100%', aspectRatio: 2 },
  heroCopy: { padding: 16, gap: 2 },
  heroDetails: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12 },
  heroSubtitle: { flexGrow: 1, flexShrink: 1 },
  customize: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sections: { gap: 10 },
  sectionTitle: { ...type.title, fontSize: 18, lineHeight: 24 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.flameSoft, borderRadius: 20, padding: 17, marginBottom: 6 },
  featureCopy: { flex: 1, gap: 3 },
  eyebrow: { ...type.micro, color: '#974020' },
  featureTitle: { ...type.display, fontSize: 20, lineHeight: 25 },
  featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.hairline },
  groupIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { ...type.small, padding: 15, backgroundColor: colors.surface, borderRadius: 14 },
  pressed: { opacity: 0.74 },
  track: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6 },
  postToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  serviceRecord: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
});
