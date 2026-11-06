import { useState } from 'react';
import { View } from 'react-native';
import { Banner, KeyValue, Timeline, type TimelineItem } from '@/components/kit';
import { Badge, Button, Caption, Card, Heading, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { Kicker, ReasonForm } from './shared';
import type { ChildSession, ChildVisit, Phase } from './types';

const TIMELINE_ACTIONS = ['check_in', 'check_out', 'checkout_exception', 'transfer', 'reissue', 'session_created', 'session_closed', 'card_replaced', 'child_registered', 'child_updated', 'family_registered', 'family_updated'];
const TIMELINE_TONE: Record<string, TimelineItem['tone']> = {
  check_in: 'success',
  check_out: 'info',
  checkout_exception: 'danger',
  transfer: 'warning',
  reissue: 'warning',
  session_closed: 'danger',
  card_replaced: 'warning',
};

/** Supervisor tools: session details, close, timeline; exports and kiosks open the website. */
export function SupervisorTab({
  session: s,
  present,
  phase,
  busy,
  onClose,
  onWebsite,
}: {
  session: ChildSession;
  present: ChildVisit[];
  phase: Phase;
  busy: boolean;
  onClose: (reason: string) => Promise<void>;
  onWebsite: (suffix: string) => void;
}) {
  const t = useT('kids.desk.supervisor');
  const tp = useT('kids.phase');
  const format = useAppFormat();
  const [closing, setClosing] = useState(false);
  const canClose = s.status === 'open' && present.length === 0;

  const events: TimelineItem[] = s.events
    .slice()
    .reverse()
    .map((e, i) => {
      const known = TIMELINE_ACTIONS.includes(e.action);
      const actor = e.actorId.startsWith('kiosk:') ? t('timeline.kiosk') : t('timeline.staff', { id: e.actorName || e.actorId });
      const children = e.childIds?.length ? ` · ${t('timeline.children', { count: e.childIds.length })}` : '';
      return {
        key: `${e.at}-${i}`,
        title: `${known ? t(`timeline.actions.${e.action}`) : e.action.replace(/_/g, ' ')}${children}`,
        subtitle: [e.note, actor].filter(Boolean).join(' · '),
        at: format.time(e.at),
        tone: TIMELINE_TONE[e.action] ?? 'neutral',
      };
    });

  return (
    <>
      <View style={{ gap: 4 }}>
        <Kicker>{t('title')}</Kicker>
        <Heading>{t('title')}</Heading>
        <Caption>{t('intro')}</Caption>
      </View>

      <Section title={t('info.title')} />
      <KeyValue
        rows={[
          { label: t('info.starts'), value: format.dateTime(s.startsAt) },
          { label: t('info.ends'), value: format.dateTime(s.endsAt) },
          { label: t('info.status'), value: tp(phase) },
          { label: t('info.rooms'), value: String(s.rooms.length) },
          { label: t('info.capacity'), value: String(s.rooms.reduce((sum, r) => sum + r.capacity, 0)) },
          { label: t('info.revision'), value: String(s.revision) },
          { label: t('info.events'), value: String(s.events.length) },
        ]}
      />

      <Section title={t('export.title')} />
      <Card style={{ gap: space.sm }}>
        <Caption>{t('export.intro')}</Caption>
        <Button label={t('export.button')} variant="secondary" icon="download" onPress={() => onWebsite('')} />
      </Card>

      <Section title={t('kiosk.title')} />
      <Card style={{ gap: space.sm }}>
        <Caption>{t('kiosk.intro')}</Caption>
        <Button label={t('kiosk.button')} variant="secondary" icon="arrowUpRight" onPress={() => onWebsite('')} />
      </Card>

      <Section title={t('close.title')} />
      <Card style={{ gap: space.sm }}>
        <Caption>{t('close.intro')}</Caption>
        {s.status !== 'open' ? (
          <Badge label={t('close.alreadyClosed')} />
        ) : present.length > 0 ? (
          <Banner tone="warning" icon="alert" title={t('close.blocked', { count: present.length })} />
        ) : null}
        {!closing ? <Button label={t('close.button')} variant="danger" size="lg" disabled={!canClose || busy} onPress={() => setClosing(true)} /> : null}
        {closing ? (
          <ReasonForm
            title={t('reason.closeTitle')}
            body={t('reason.closeBody')}
            confirmLabel={t('close.button')}
            danger
            busy={busy}
            onCancel={() => setClosing(false)}
            onConfirm={(reason) => {
              void onClose(reason).then(() => setClosing(false));
            }}
          />
        ) : null}
      </Card>

      <Section title={t('timeline.title')} />
      {events.length ? <Timeline items={events} /> : <Caption>{t('timeline.empty')}</Caption>}
    </>
  );
}
