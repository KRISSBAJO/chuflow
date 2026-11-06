import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Banner, SearchBar, SwitchRow } from '@/components/kit';
import { Badge, Button, Caption, Card, Chip, EmptyState, Heading, ListRow, Notice, tap } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { familyInitials } from './age';
import { BigCode, CodeInput, InitialAvatar, KIDS, Kicker } from './shared';
import type { ChildSession, FamilySelection, ReceiptData } from './types';

type CheckInBody = { familyId: string; guardianId: string; adultConfirmed: boolean; children: { childId: string; roomId: string }[] };

/** A · Scan a card or search, B · choose children and rooms, then the pickup receipt. */
export function CheckinTab({
  session,
  busy,
  selection,
  receipt,
  onScanCode,
  onOpenFamily,
  onCheckIn,
  onCancelSelection,
  onNextFamily,
  onCamera,
  onSearchError,
  onPrint,
}: {
  session: ChildSession;
  busy: boolean;
  selection: FamilySelection | null;
  receipt: ReceiptData | null;
  onScanCode: (code: string) => Promise<void>;
  onOpenFamily: (familyId: string) => Promise<void>;
  onCheckIn: (body: CheckInBody) => Promise<void>;
  onCancelSelection: () => void;
  onNextFamily: () => void;
  onCamera: () => void;
  onSearchError: () => void;
  onPrint: () => void;
}) {
  const t = useT('kids.desk');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ term: string; rows: { _id: string; name: string }[] } | null>(null);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get<{ _id: string; name: string }[]>(`/children/sessions/${session._id}/families?search=${encodeURIComponent(q)}`)
        .then((rows) => {
          if (active) setFound({ term: q, rows });
        })
        .catch(() => {
          if (active) onSearchError();
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, session._id, onSearchError]);
  const results = found && found.term === search.trim() ? found.rows : [];

  if (session.status !== 'open') {
    return <Banner tone="warning" icon="lock" title={t('closedBanner.title')} body={t('closedBanner.body')} />;
  }

  if (receipt) {
    return (
      <Receipt
        data={receipt}
        onDone={() => {
          onNextFamily();
          setCode('');
          setSearch('');
          setTimeout(() => codeRef.current?.focus(), 0);
        }}
        onPrint={onPrint}
      />
    );
  }

  if (selection) {
    return (
      <Selection
        key={selection.familyId}
        selection={selection}
        onSubmit={async (body) => {
          await onCheckIn(body);
          setCode('');
          setSearch('');
        }}
        onCancel={onCancelSelection}
      />
    );
  }

  const q = search.trim();

  return (
    <>
      <Card style={{ gap: space.sm }}>
        <Kicker>{t('checkin.kicker')}</Kicker>
        <Heading>{t('checkin.title')}</Heading>
        <Caption>{t('checkin.intro')}</Caption>
        <CodeInput
          ref={codeRef}
          label={t('checkin.cardLabel')}
          value={code}
          onChangeText={setCode}
          placeholder={t('checkin.placeholder')}
          autoFocus
          busy={busy}
          submitLabel={t('checkin.find')}
          scanLabel={t('checkin.camera')}
          onScan={onCamera}
          onSubmit={() => {
            void onScanCode(code).then(() => setCode(''));
          }}
        />
      </Card>

      <Card style={{ gap: space.sm }}>
        <Kicker>{t('checkin.searchKicker')}</Kicker>
        <Text style={type.label}>{t('checkin.searchTitle')}</Text>
        <Caption>{t('checkin.searchIntro')}</Caption>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('checkin.searchPlaceholder')} />
        {q.length >= 2 ? (
          searching ? (
            <Caption>{t('checkin.searching')}</Caption>
          ) : results.length ? (
            results.map((family, index) => (
              <ListRow
                key={family._id}
                divider={index > 0}
                title={family.name}
                left={<InitialAvatar text={familyInitials(family.name)} size={32} />}
                onPress={() => void onOpenFamily(family._id)}
              />
            ))
          ) : (
            <Caption>{t('checkin.noResults', { query: q })}</Caption>
          )
        ) : null}
      </Card>

      <EmptyState icon="sparkle" title={t('checkin.readyTitle')} body={t('checkin.readyBody')} />
    </>
  );
}

/** Step B: which children are staying and which classroom each goes to. */
function Selection({ selection, onSubmit, onCancel }: { selection: FamilySelection; onSubmit: (body: CheckInBody) => Promise<void>; onCancel: () => void }) {
  const t = useT('kids.desk.flow');
  const tc = useT('common.actions');
  const [guardian, setGuardian] = useState(selection.guardians[0]?.id || '');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const count = Object.keys(selected).length;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        familyId: selection.familyId,
        guardianId: guardian,
        adultConfirmed: confirmed,
        children: Object.entries(selected).map(([childId, roomId]) => ({ childId, roomId })),
      });
    } catch (e) {
      setError(errorMessage(e, t('failed')));
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <Kicker>{t('heading')}</Kicker>
        <Heading>{selection.name}</Heading>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.label}>{t('adult')}</Text>
        <View style={styles.chips}>
          {selection.guardians.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={g.id === guardian}
              onPress={() => {
                setGuardian(g.id);
                setSelected({});
                setConfirmed(false);
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        {selection.children.map((c) => {
          const linked = c.guardianIds.includes(guardian);
          const available = c.rooms.some((r) => r.remaining > 0);
          const chosen = c.id in selected;
          const disabled = c.checkedIn || !linked || !available;
          return (
            <View key={c.id} style={[styles.child, chosen && styles.childChosen]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: chosen, disabled }}
                disabled={disabled}
                onPress={() => {
                  tap();
                  setSelected((rows) => {
                    const next = { ...rows };
                    if (chosen) delete next[c.id];
                    else next[c.id] = c.rooms.find((r) => r.remaining > 0)?.id || '';
                    return next;
                  });
                }}
                style={styles.childRow}
              >
                <View style={[styles.check, chosen && styles.checkOn, disabled && { opacity: 0.35 }]}>{chosen ? <Icon name="check" size={14} color="#ffffff" strokeWidth={2.4} /> : null}</View>
                <InitialAvatar text={familyInitials(c.name)} size={32} tone={chosen ? 'green' : 'plain'} />
                <Text style={[type.label, { flex: 1 }, disabled && { color: colors.faint }]} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
              {c.checkedIn ? (
                <Badge label={t('already')} tone="info" />
              ) : !linked ? (
                <Caption>{t('linked')}</Caption>
              ) : !c.rooms.length ? (
                <Badge label={t('noRoom')} tone="danger" />
              ) : chosen ? (
                <View style={{ gap: 6 }}>
                  <Caption>{t('room')}</Caption>
                  <View style={styles.chips}>
                    {c.rooms.map((r) => (
                      <Chip
                        key={r.id}
                        label={`${r.name} · ${t('spaces', { count: r.remaining })}`}
                        selected={selected[c.id] === r.id}
                        onPress={() => {
                          if (r.remaining < 1) return;
                          setSelected((rows) => ({ ...rows, [c.id]: r.id }));
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <SwitchRow title={t('staffConfirm')} value={confirmed} onChange={setConfirmed} divider />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Caption>{t('selected', { count })}</Caption>
      <Button label={busy ? t('checking') : t('submit')} size="lg" loading={busy} disabled={!confirmed || !count} onPress={() => void submit()} />
      <Button label={tc('cancel')} variant="ghost" onPress={onCancel} />
    </Card>
  );
}

/** Pickup receipt: the code the guardian keeps, plus one label per child. */
export function Receipt({ data, onDone, onPrint }: { data: ReceiptData; onDone: () => void; onPrint?: () => void }) {
  const t = useT('kids.desk.flow');
  return (
    <Card style={{ gap: space.md, borderWidth: 1, borderColor: KIDS.amber, backgroundColor: KIDS.amberSoft }}>
      <View style={{ gap: 4 }}>
        <Kicker>{t('receipt')}</Kicker>
        <Heading>{t('keep')}</Heading>
        <Caption>{data.sessionName}</Caption>
      </View>
      <BigCode display={data.display} code={data.code} copiedLabel={t('codeCopied')} />
      <Caption>
        {t('present')} {t('authorized')}
      </Caption>
      <View style={{ gap: space.sm }}>
        {data.children.map((c, i) => (
          <View key={i} style={styles.label}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={type.label}>{c.name}</Text>
              <Caption>{c.room}</Caption>
            </View>
            {c.careAlert ? <Badge label={t('care')} tone="danger" /> : null}
          </View>
        ))}
      </View>
      <View style={{ gap: space.sm }}>
        <Button label={t('done')} size="lg" onPress={onDone} />
        {onPrint ? <Button label={t('printWebsite')} variant="secondary" icon="print" onPress={onPrint} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  child: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.inset, padding: space.md, gap: space.sm },
  childChosen: { borderColor: KIDS.green, backgroundColor: KIDS.greenSoft },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.hairlineStrong, backgroundColor: colors.inset, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: KIDS.green, borderColor: KIDS.green },
  label: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.hairlineStrong, backgroundColor: colors.inset, padding: space.md },
});
