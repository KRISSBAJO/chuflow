import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field } from '@/components/ui';
import { toast } from '@/components/toast';
import { colors, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

type Message = { _id: string; authorName: string; body: string; state: 'pending' | 'approved'; createdAt: string };

const path = '/youth-participant/chat';

export function YouthGroupChat() {
  const t = useT('youth.chat');
  const format = useAppFormat();
  const chat = useApi<Message[]>(path);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string>();
  const pending = chat.data?.some(message => message.state === 'pending');
  async function send() {
    setBusy(true);
    try {
      await api.post(path + '/messages', { body: body.trim() });
      setBody('');
      await chat.reload();
    } catch {
      toast.error(t('failed'));
      await chat.reload();
    } finally {
      setBusy(false);
    }
  }
  async function report(messageId: string) {
    setBusy(true);
    try {
      await api.post(path + '/messages/' + messageId + '/report', {});
      setConfirming(undefined);
      toast.success(t('reported'));
    } catch {
      toast.error(t('failed'));
      await chat.reload();
    } finally {
      setBusy(false);
    }
  }

  return <View style={styles.section}>
    <Text accessibilityRole="header" style={type.title}>{t('title')}</Text>
    <Text style={type.small}>{t('help')}</Text>
    <Button label={t('refresh')} variant="secondary" size="sm" disabled={busy || chat.loading || chat.refreshing}
      loading={chat.refreshing} onPress={() => void chat.refresh()} />
    {chat.loading ? <Text accessibilityLiveRegion="polite" style={type.small}>{t('loading')}</Text> : null}
    {chat.error ? <Text accessibilityLiveRegion="polite" style={type.body}>{t('unavailable')}</Text> : null}
    {!chat.error && chat.data ? <>
      {pending ? <Text accessibilityLiveRegion="polite" style={type.body}>{t('pending')}</Text> : <>
        <Field label={t('message')} multiline maxLength={800} value={body} onChangeText={setBody} />
        <Button label={t('send')} size="sm" disabled={busy || !body.trim()} onPress={() => void send()} />
      </>}
      {chat.data.length === 0 ? <Text style={type.small}>{t('empty')}</Text> : null}
      {chat.data.map(message => <View key={message._id} style={styles.message}>
        <Text style={type.title}>{message.authorName}</Text>
        <Text style={type.small}>{format.dateTime(message.createdAt)}</Text>
        <Text style={type.body}>{message.body}</Text>
        {message.state === 'approved' ? confirming === message._id ? <View style={styles.actions}>
          <Button label={t('reportConfirm')} variant="secondary" size="sm" disabled={busy} onPress={() => void report(message._id)} />
          <Button label={t('cancel')} variant="secondary" size="sm" disabled={busy} onPress={() => setConfirming(undefined)} />
        </View> : <Button label={t('report')} variant="secondary" size="sm" disabled={busy}
          onPress={() => setConfirming(message._id)} /> : null}
      </View>)}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12, marginBottom: 12 },
  message: { gap: 6, borderColor: colors.hairline, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
