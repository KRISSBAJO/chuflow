import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { SheetPicker, SwitchRow } from '@/components/kit';
import { Badge, Button, Caption, Card, Chip, EmptyState, Field, Heading, Notice, tap } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { durationLabel } from './desk-rooms';
import { CodeInput, InitialAvatar, Kicker, KIDS, MIN_REASON } from './shared';
import { familyInitials } from './age';
import type { ChildSession, ChildVisit } from './types';

type CheckoutBody = { visitIds: string[]; guardianId: string; identityConfirmed: boolean; pickupCode?: string; exceptionReason?: string };

/** C · Verify the pickup receipt, pick the authorized adult, confirm identity and release. */
export function PickupTab({
  session: s,
  present,
  now,
  canManage,
  busy,
  code,
  onCodeChange,
  matched,
  onMatchedChange,
  onVerify,
  onCamera,
  onCheckout,
}: {
  session: ChildSession;
  present: ChildVisit[];
  now: number;
  canManage: boolean;
  busy: boolean;
  code: string;
  onCodeChange: (value: string) => void;
  matched: string[];
  onMatchedChange: (ids: string[]) => void;
  onVerify: (code: string) => Promise<void>;
  onCamera: () => void;
  onCheckout: (body: CheckoutBody, adultName: string) => Promise<void>;
}) {
  const t = useT('kids.desk');
  const [guardian, setGuardian] = useState('');
  const [identity, setIdentity] = useState(false);
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState('');

  const roomName = (roomId: string) => s.rooms.find((r) => r.id === roomId)?.name || '';
  const chosen = present.filter((v) => matched.includes(v.id));
  const adults = chosen[0]?.authorizedPickup.filter((g) => chosen.every((v) => v.authorizedPickup.some((a) => a.id === g.id))) || [];
  const adult = adults.find((g) => g.id === guardian);
  const reasonMissing = exception && reason.trim().length < MIN_REASON;

  function reset() {
    setGuardian('');
    setIdentity(false);
  }

  async function checkout() {
    await onCheckout(
      {
        visitIds: matched,
        guardianId: guardian,
        identityConfirmed: identity,
        ...(exception ? { exceptionReason: reason.trim() } : { pickupCode: code.trim() }),
      },
      adult?.name || '',
    );
    reset();
    setReason('');
  }

  return (
    <>
      {chosen.length > 0 ? (
        <Card style={{ gap: space.md, borderWidth: 1, borderColor: KIDS.green }}>
          <View style={{ gap: 4 }}>
            <Heading>{t('pickup.matchedTitle')}</Heading>
            <Caption>{t('pickup.matchedIntro', { count: chosen.length })}</Caption>
          </View>
          {chosen.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: true }}
              onPress={() => {
                tap();
                onMatchedChange(matched.filter((id) => id !== v.id));
                reset();
              }}
              style={styles.childRow}
            >
              <InitialAvatar text={familyInitials(v.childName)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.label}>{v.childName}</Text>
                <Caption>
                  {roomName(v.roomId)} · {durationLabel(t, v.checkedInAt, now)}
                </Caption>
                {v.pickupNotes ? <Text style={[type.small, { color: KIDS.amberInk, marginTop: 2 }]}>{v.pickupNotes}</Text> : null}
              </View>
              <View style={styles.checkOn}>
                <Icon name="check" size={14} color="#ffffff" strokeWidth={2.4} />
              </View>
            </Pressable>
          ))}

          <View style={{ gap: space.sm }}>
            <Text style={type.label}>{t('pickup.adultLabel')}</Text>
            {adults.length ? (
              <View style={styles.chips}>
                {adults.map((g) => (
                  <Chip
                    key={g.id}
                    label={t('pickup.adultOption', { name: g.name, relationship: g.relationship })}
                    selected={g.id === guardian}
                    onPress={() => {
                      setGuardian(g.id);
                      setIdentity(false);
                    }}
                  />
                ))}
              </View>
            ) : (
              <Notice tone="danger">{t('pickup.noAdult')}</Notice>
            )}
            {adult ? <Badge label={t('pickup.phone', { phone: adult.phone || '—' })} tone="info" /> : null}
          </View>

          <SwitchRow title={t('pickup.identity')} value={identity} onChange={setIdentity} divider />
          <Button label={busy ? t('pickup.recording') : t('pickup.confirm')} size="lg" loading={busy} disabled={!identity || !guardian || reasonMissing} onPress={() => void checkout()} />
        </Card>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <Kicker>{t('pickup.kicker')}</Kicker>
        <Heading>{t('pickup.title')}</Heading>
        <Caption>{t('pickup.intro')}</Caption>
        <CodeInput
          label={t('pickup.codeLabel')}
          value={code}
          onChangeText={(value) => {
            onCodeChange(value);
            reset();
          }}
          placeholder={t('pickup.placeholder')}
          autoFocus={!chosen.length}
          busy={busy}
          submitLabel={t('pickup.verify')}
          scanLabel={t('checkin.camera')}
          onScan={onCamera}
          onSubmit={() => void onVerify(code)}
        />
      </Card>

      {canManage ? (
        <Card style={{ gap: space.sm }}>
          <Kicker>{t('pickup.exceptionTitle')}</Kicker>
          <SwitchRow
            title={t('pickup.exceptionToggle')}
            value={exception}
            onChange={(value) => {
              setException(value);
              onMatchedChange([]);
              reset();
            }}
          />
          {exception ? (
            <View style={{ gap: space.md }}>
              <Caption>{t('pickup.exceptionIntro')}</Caption>
              <SheetPicker
                label={t('pickup.chooseChild')}
                placeholder={t('pickup.choosePlaceholder')}
                value={matched[0] || ''}
                options={present.map((v) => ({ value: v.id, label: v.childName, hint: roomName(v.roomId) }))}
                onChange={(id) => {
                  onMatchedChange([id]);
                  reset();
                }}
              />
              <Field
                label={t('pickup.reasonLabel')}
                value={reason}
                onChangeText={setReason}
                placeholder={t('pickup.reasonPlaceholder')}
                multiline
                hint={reason.length > 0 && reasonMissing ? t('pickup.reasonShort', { count: MIN_REASON - reason.trim().length }) : undefined}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {!chosen.length ? <EmptyState icon="search" title={t('pickup.emptyTitle')} body={t('pickup.emptyBody')} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  childRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.inset, borderRadius: radius.md, padding: space.md },
  checkOn: { width: 24, height: 24, borderRadius: 7, backgroundColor: KIDS.green, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
