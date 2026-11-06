import * as WebBrowser from 'expo-web-browser';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banner, StatGrid, StatTile } from '@/components/kit';
import { Caption, ErrorState, Heading, Loading, Notice, Screen, Segmented } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { phaseOf } from './age';
import { CheckinTab } from './desk-checkin';
import { PickupTab } from './desk-pickup';
import { RoomsTab } from './desk-rooms';
import { SupervisorTab } from './desk-supervisor';
import { takePendingScan } from './scan-bus';
import { Kicker, kidsHref, PhaseBadge, useMinuteNow } from './shared';
import type { ChildSession, FamilySelection, ReceiptData } from './types';

export type DeskTab = 'checkin' | 'rooms' | 'pickup' | 'supervisor';
const TABS: DeskTab[] = ['checkin', 'rooms', 'pickup', 'supervisor'];
const REFRESH_MS = 15_000;
const isTab = (value: string | undefined): value is DeskTab => (TABS as string[]).includes(value ?? '');

/**
 * The session desk: the website's four-tab console (check-in / rooms / pickup / supervisor) at a
 * phone's scale. Deep links accept `?tab=&code=&room=`; the camera modal hands codes back through
 * the scan bus.
 */
export function SessionDesk() {
  const params = useLocalSearchParams<{ id: string; tab?: string; code?: string; room?: string }>();
  const id = params.id;
  const t = useT('kids.desk');
  const format = useAppFormat();
  const { user } = useSession();
  const supervise = can.kidsSupervise(user?.role);
  const now = useMinuteNow();

  const session = useApi<ChildSession>(`/children/sessions/${id}`);
  const { reload } = session;
  const s = session.data;
  const canManage = !!s?.canManage && supervise;

  const [tab, setTab] = useState<DeskTab>(isTab(params.tab) ? params.tab : 'checkin');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  /* check-in */
  const [selection, setSelection] = useState<FamilySelection | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  /* pickup */
  const [pickupCode, setPickupCode] = useState('');
  const [matched, setMatched] = useState<string[]>([]);
  /* rooms */
  const [reissued, setReissued] = useState<ReceiptData | null>(null);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => void reload(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload]),
  );

  const act = useCallback(
    async (fn: () => Promise<void>) => {
      setError('');
      setNotice('');
      setBusy(true);
      try {
        await fn();
        await reload();
      } catch (e) {
        setError(errorMessage(e, t('errors.unknown')));
      } finally {
        setBusy(false);
      }
    },
    [reload, t],
  );

  const scanCard = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      await act(async () => {
        const found = await api.post<FamilySelection>(`/children/sessions/${id}/scan`, { code: value });
        setSelection(found);
        setReceipt(null);
      });
    },
    [act, id],
  );

  const verifyPickup = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      await act(async () => {
        const r = await api.post<{ visitIds: string[] }>(`/children/sessions/${id}/pickup`, { code: value });
        setPickupCode(value);
        setMatched(r.visitIds);
      });
    },
    [act, id],
  );

  /* A code arriving by deep link or from the camera modal is handled once. */
  const handledCode = useRef<string | null>(null);
  const applyCode = useCallback(
    (code: string, target: 'checkin' | 'pickup') => {
      if (!code || handledCode.current === code) return;
      handledCode.current = code;
      setTab(target);
      if (target === 'pickup') void verifyPickup(code);
      else void scanCard(code);
    },
    [scanCard, verifyPickup],
  );

  useFocusEffect(
    useCallback(() => {
      if (isTab(params.tab)) setTab(params.tab);
      if (params.code) {
        applyCode(params.code, params.tab === 'pickup' ? 'pickup' : 'checkin');
        router.setParams({ code: '' });
      }
      const scan = takePendingScan(id);
      if (scan) applyCode(scan.code, scan.tab);
    }, [id, params.code, params.tab, applyCode]),
  );

  const openScan = (target: 'checkin' | 'pickup') => router.push(kidsHref('/kids/scan', { sessionId: id, tab: target }));
  const openWebsite = (path: string) => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);

  if (!s) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        {session.loading ? <Loading /> : <ErrorState message={session.error ?? ''} onRetry={() => void session.refresh()} />}
      </Screen>
    );
  }

  const present = s.visits.filter((v) => v.status === 'checked_in');
  const presentIn = (roomId: string) => present.filter((v) => v.roomId === roomId).length;
  const phase = phaseOf(s, present.length, now);
  const roomsWithSpace = s.rooms.filter((r) => presentIn(r.id) < r.capacity).length;

  const tabs = [
    { value: 'checkin' as DeskTab, label: t('tabs.checkin') },
    { value: 'rooms' as DeskTab, label: t('tabs.rooms'), count: present.length },
    { value: 'pickup' as DeskTab, label: t('tabs.pickup'), count: matched.length || undefined },
    ...(canManage ? [{ value: 'supervisor' as DeskTab, label: t('tabs.supervisor') }] : []),
  ];
  const activeTab = tab === 'supervisor' && !canManage ? 'checkin' : tab;

  function switchTab(next: DeskTab) {
    setTab(next);
    setError('');
    setNotice('');
  }

  return (
    <Screen safeTop={false} refreshing={session.refreshing} onRefresh={() => void session.refresh()}>
      <Stack.Screen options={{ title: s.name }} />
      <View style={{ gap: 4 }}>
        <Kicker>{t('title')}</Kicker>
        <View style={styles.titleRow}>
          <Heading style={{ flex: 1 }} numberOfLines={2}>
            {s.name}
          </Heading>
          <PhaseBadge phase={phase} />
        </View>
        <Caption>
          {format.date(s.startsAt, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} – {format.time(s.endsAt)}
        </Caption>
      </View>
      {phase === 'overdue' ? <Banner tone="danger" icon="alert" title={t('header.overdueHint', { count: present.length })} /> : null}

      <StatGrid>
        <StatTile label={t('header.here')} value={present.length} tone="success" />
        <StatTile label={t('header.attended')} value={s.visits.length} />
        <StatTile label={t('header.collected')} value={s.visits.length - present.length} tone="info" />
        <StatTile label={t('header.rooms')} value={s.rooms.length} hint={t('header.roomsHint', { open: roomsWithSpace })} tone="warning" />
      </StatGrid>

      <Segmented options={tabs} value={activeTab} onChange={switchTab} />

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" icon="check">
          {notice}
        </Notice>
      ) : null}

      {activeTab === 'checkin' ? (
        <CheckinTab
          session={s}
          busy={busy}
          selection={selection}
          receipt={receipt}
          onScanCode={scanCard}
          onOpenFamily={(familyId) =>
            act(async () => {
              setSelection(await api.get<FamilySelection>(`/children/sessions/${id}/families/${familyId}`));
              setReceipt(null);
            })
          }
          onCheckIn={async (body) => {
            const r = await api.post<ReceiptData>(`/children/sessions/${id}/check-in`, body);
            setReceipt(r);
            setSelection(null);
            setError('');
            setNotice(t('checkin.success', { count: r.children.length }));
            await reload();
          }}
          onCancelSelection={() => setSelection(null)}
          onNextFamily={() => {
            setReceipt(null);
            setSelection(null);
            setNotice('');
          }}
          onCamera={() => openScan('checkin')}
          onSearchError={() => setError(t('errors.search'))}
          onPrint={() => openWebsite(`/children/sessions/${id}?tab=checkin`)}
        />
      ) : null}

      {activeTab === 'rooms' ? (
        <RoomsTab
          session={s}
          present={present}
          now={now}
          canManage={canManage}
          busy={busy}
          initialRoom={params.room}
          reissued={reissued}
          onDismissReissued={() => setReissued(null)}
          onTransfer={(visit, room, reason) =>
            act(async () => {
              await api.post(`/children/sessions/${id}/action`, { action: 'transfer', visitId: visit.id, roomId: room.id, reason, expectedRevision: s.revision });
              setNotice(t('supervisor.reason.recorded'));
            })
          }
          onReissue={(visit, reason) =>
            act(async () => {
              const r = await api.post<ReceiptData>(`/children/sessions/${id}/action`, { action: 'reissue', visitId: visit.id, reason, expectedRevision: s.revision });
              setReissued(r);
              setNotice(t('supervisor.reason.recorded'));
            })
          }
          onPrint={() => openWebsite(`/children/sessions/${id}?tab=rooms`)}
        />
      ) : null}

      {activeTab === 'pickup' ? (
        <PickupTab
          session={s}
          present={present}
          now={now}
          canManage={canManage}
          busy={busy}
          code={pickupCode}
          onCodeChange={(value) => {
            setPickupCode(value);
            setMatched([]);
          }}
          matched={matched}
          onMatchedChange={setMatched}
          onVerify={verifyPickup}
          onCamera={() => openScan('pickup')}
          onCheckout={(body, adultName) =>
            act(async () => {
              const count = body.visitIds.length;
              await api.post(`/children/sessions/${id}/check-out`, { ...body, expectedRevision: s.revision });
              setMatched([]);
              setPickupCode('');
              setNotice(t('pickup.success', { count, name: adultName }));
            })
          }
        />
      ) : null}

      {activeTab === 'supervisor' && canManage ? (
        <SupervisorTab
          session={s}
          present={present}
          phase={phase}
          busy={busy}
          onClose={(reason) =>
            act(async () => {
              await api.post(`/children/sessions/${id}/action`, { action: 'close', reason, expectedRevision: s.revision });
              setNotice(t('supervisor.close.done'));
            })
          }
          onWebsite={(suffix) => openWebsite(`/children/sessions/${id}?tab=supervisor${suffix}`)}
        />
      ) : null}
      <Text style={{ height: space.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
