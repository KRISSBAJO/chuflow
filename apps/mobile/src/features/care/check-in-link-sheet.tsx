import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Notice } from '@/components/ui';
import { colors, fonts, radius, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import type { CareRecord } from './types';

/**
 * Creates a private member check-in link (POST /care/cases/:id/check-in-link) and offers Copy and
 * Share. Share falls back to copying where the system share sheet isn't available (web). The body
 * mounts fresh each time the sheet opens, so an old link is never shown again.
 */
export function CheckInLinkSheet({ record, visible, onClose }: { record: CareRecord; visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return <LinkBody record={record} onClose={onClose} />;
}

function LinkBody({ record, onClose }: { record: CareRecord; onClose: () => void }) {
  const t = useT('care.link');
  const tc = useT('common');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ url: string }>(`/care/cases/${record._id}/check-in-link`);
      setLink(result.url);
    } catch (cause) {
      setError(errorMessage(cause, t('error')));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await Clipboard.setStringAsync(link);
    toast.success(t('copied'));
  }

  async function share() {
    const message = t('shareMessage', { name: record.firstName, url: link });
    try {
      await Share.share({ message, url: link });
    } catch {
      await copy();
    }
  }

  return (
    <Sheet visible onClose={onClose} title={t('title')}>
      <View style={{ gap: space.lg, paddingBottom: space.sm }}>
        <Caption>{t('hint')}</Caption>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {link ? (
          <>
            <View style={styles.linkBox}>
              <Text style={styles.link} selectable numberOfLines={3}>
                {link}
              </Text>
            </View>
            <View style={styles.row}>
              <Button label={tc('actions.copy')} icon="copy" variant="secondary" style={{ flex: 1 }} onPress={() => void copy()} />
              <Button label={tc('actions.share')} icon="share" style={{ flex: 1 }} onPress={() => void share()} />
            </View>
          </>
        ) : (
          <Button label={t('create')} icon="link" loading={busy} onPress={() => void create()} />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  linkBox: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  link: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink },
  row: { flexDirection: 'row', gap: space.sm },
});
