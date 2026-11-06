import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SearchBar } from '@/components/kit';
import { Badge, Button, Caption, Card, Chip, EmptyState, tap } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT, type Translator } from '@/i18n/provider';
import { Receipt } from './desk-checkin';
import { ageShort, KIDS, ReasonForm, RoomCard } from './shared';
import type { ChildSession, ChildVisit, ReceiptData, Room } from './types';

const PAGE_SIZE = 25;

type Pending = { action: 'transfer'; visit: ChildVisit; room: Room } | { action: 'reissue'; visit: ChildVisit };

export function durationLabel(t: Translator, checkedInAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(checkedInAt)) / 60000));
  if (minutes < 1) return t('rooms.justArrived');
  if (minutes < 60) return t('rooms.inForMinutes', { minutes });
  return t('rooms.inForHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/** B · Room board and roster with supervisor transfers and receipt replacement. */
export function RoomsTab({
  session: s,
  present,
  now,
  canManage,
  busy,
  initialRoom,
  reissued,
  onDismissReissued,
  onTransfer,
  onReissue,
  onPrint,
}: {
  session: ChildSession;
  present: ChildVisit[];
  now: number;
  canManage: boolean;
  busy: boolean;
  initialRoom?: string;
  reissued: ReceiptData | null;
  onDismissReissued: () => void;
  onTransfer: (visit: ChildVisit, room: Room, reason: string) => Promise<void>;
  onReissue: (visit: ChildVisit, reason: string) => Promise<void>;
  onPrint: () => void;
}) {
  const t = useT('kids.desk');
  const ta = useT('kids.age');
  const tk = useT('kids.common');
  const [roomFilter, setRoomFilter] = useState(initialRoom && s.rooms.some((r) => r.id === initialRoom) ? initialRoom : '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const presentIn = (roomId: string) => present.filter((v) => v.roomId === roomId).length;
  const roomName = (roomId: string) => s.rooms.find((r) => r.id === roomId)?.name || '';
  const visible = present.filter((v) => (!roomFilter || v.roomId === roomFilter) && v.childName.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);

  async function supervise(job: Pending, reason: string) {
    if (job.action === 'transfer') await onTransfer(job.visit, job.room, reason);
    else await onReissue(job.visit, reason);
    setPending(null);
  }

  return (
    <>
      {reissued ? <Receipt data={reissued} onDone={onDismissReissued} onPrint={onPrint} /> : null}

      <View style={styles.grid}>
        {s.rooms.map((r) => (
          <RoomCard
            key={r.id}
            name={r.name}
            subtitle={tk('ageRange', { from: ageShort(ta, r.minMonths), to: ageShort(ta, r.maxMonths) })}
            present={presentIn(r.id)}
            capacity={r.capacity}
            selected={roomFilter === r.id}
            onPress={() => {
              setRoomFilter(roomFilter === r.id ? '' : r.id);
              setPage(1);
            }}
            style={styles.half}
          />
        ))}
      </View>

      <SearchBar
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('rooms.searchPlaceholder')}
      />
      <View style={styles.rowBetween}>
        <Caption>{t('rooms.showing', { count: visible.length })}</Caption>
        {roomFilter ? (
          <Pressable hitSlop={8} onPress={() => setRoomFilter('')}>
            <Text style={styles.link}>{t('rooms.showAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      {visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((v) => {
        const open = expanded === v.id;
        return (
          <Card key={v.id} style={{ gap: space.sm }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={type.label} numberOfLines={1}>
                  {v.childName}
                </Text>
                <View style={styles.meta}>
                  <Badge label={roomName(v.roomId)} tone="success" />
                  <Caption>{durationLabel(t, v.checkedInAt, now)}</Caption>
                </View>
                <Caption numberOfLines={1}>{t('rooms.broughtBy', { name: v.broughtByName })}</Caption>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={type.micro}>{t('rooms.code')}</Text>
                <Text style={styles.code}>{v.pickupDisplay}</Text>
              </View>
            </View>

            {v.careNotes || v.pickupNotes ? (
              <Pressable
                onPress={() => {
                  tap();
                  setExpanded(open ? null : v.id);
                }}
                style={styles.meta}
              >
                {v.careNotes ? <Badge label={t('rooms.careAlert')} tone="danger" /> : null}
                {v.pickupNotes ? <Badge label={t('rooms.pickupNotes')} tone="warning" /> : null}
              </Pressable>
            ) : null}
            {open && v.careNotes ? (
              <View style={[styles.note, { backgroundColor: colors.dangerBg }]}>
                <Text style={[type.micro, { color: colors.danger, textTransform: 'uppercase' }]}>{t('rooms.careNotes')}</Text>
                <Text style={type.body}>{v.careNotes}</Text>
              </View>
            ) : null}
            {open && v.pickupNotes ? (
              <View style={[styles.note, { backgroundColor: KIDS.amberSoft }]}>
                <Text style={[type.micro, { color: KIDS.amberInk, textTransform: 'uppercase' }]}>{t('rooms.pickupNotes')}</Text>
                <Text style={type.body}>{v.pickupNotes}</Text>
              </View>
            ) : null}

            {canManage && s.status === 'open' && !pending ? (
              <View style={{ gap: 6 }}>
                <Caption>{t('rooms.transfer')}</Caption>
                <View style={styles.meta}>
                  {s.rooms
                    .filter((r) => r.id !== v.roomId)
                    .map((r) => (
                      <Chip key={r.id} label={`${r.name} · ${presentIn(r.id)}/${r.capacity}`} selected={false} onPress={() => setPending({ action: 'transfer', visit: v, room: r })} />
                    ))}
                  <Chip label={t('rooms.reissue')} icon="refresh" selected={false} onPress={() => setPending({ action: 'reissue', visit: v })} />
                </View>
              </View>
            ) : null}

            {pending && pending.visit.id === v.id ? (
              <ReasonForm
                key={pending.action}
                title={pending.action === 'transfer' ? t('supervisor.reason.transferTitle', { name: v.childName, room: pending.room.name }) : t('supervisor.reason.reissueTitle', { name: v.childName })}
                body={pending.action === 'transfer' ? t('supervisor.reason.transferBody') : t('supervisor.reason.reissueBody')}
                confirmLabel={t('supervisor.reason.confirm')}
                busy={busy}
                onCancel={() => setPending(null)}
                onConfirm={(reason) => void supervise(pending, reason)}
              />
            ) : null}
          </Card>
        );
      })}

      {!visible.length ? <EmptyState icon="smile" title={t('rooms.emptyTitle')} body={t('rooms.emptyBody')} /> : null}

      {pages > 1 ? (
        <View style={styles.rowBetween}>
          <Button label={t('rooms.previous')} variant="secondary" size="sm" disabled={current <= 1} onPress={() => setPage(current - 1)} />
          <Caption>{t('rooms.page', { page: current, pages })}</Caption>
          <Button label={t('rooms.next')} variant="secondary" size="sm" disabled={current >= pages} onPress={() => setPage(current + 1)} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  half: { flexGrow: 1, flexBasis: '45%' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  code: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: 2, color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { borderRadius: radius.md, padding: space.md, gap: 4 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: KIDS.green },
});
