import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { toast } from '@/components/toast';
import { Button, Caption, Notice } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { discardQueued, flushAttendance, useAttendanceOutbox, useOnline } from '@/lib/offline-queue';

/** Counts saved on this phone with no signal: how many wait, which the API refused, and a way to send or drop them. */
export function OutboxNotices({ onSent }: { onSent?: () => void }) {
  const t = useT('attendance.count');
  const common = useT('common.actions');
  const online = useOnline();
  const outbox = useAttendanceOutbox();
  const waiting = outbox.filter((item) => !item.error);
  const failed = outbox.filter((item) => item.error);

  if (online && !outbox.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      {!online ? (
        <Notice tone="warning" icon="cloudOff">
          {t('offline')}
        </Notice>
      ) : null}

      {waiting.length ? (
        <View style={styles.outbox}>
          <Icon name="clock" size={15} color={colors.warning} />
          <Text style={styles.outboxText} numberOfLines={2}>
            {t('waiting', { count: waiting.length })}
          </Text>
          <Button
            label={common('sendNow')}
            size="sm"
            variant="secondary"
            disabled={!online}
            onPress={() =>
              void flushAttendance().then((sent) => {
                if (sent) {
                  toast.success(t('sent', { count: sent }));
                  onSent?.();
                }
              })
            }
          />
        </View>
      ) : null}

      {failed.map((item) => (
        <View key={item.id} style={styles.failed}>
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: colors.danger }]} numberOfLines={1}>
              {t('failed', { label: item.label })}
            </Text>
            <Caption numberOfLines={2}>{item.error}</Caption>
          </View>
          <Button label={common('remove')} size="sm" variant="secondary" onPress={() => void discardQueued(item.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  outbox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.warningBg, borderRadius: radius.md, paddingVertical: 8, paddingLeft: space.md, paddingRight: 8 },
  outboxText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warning },
  failed: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: space.md },
});
