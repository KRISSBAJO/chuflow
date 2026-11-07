import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, ListRow, Notice, Screen, Title } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { useSession } from '@/lib/session';

export default function ChooseWorkspaceScreen() {
  const t = useT('auth.workspacePicker');
  const { user, workspaces, switchWorkspace, closeWorkspacePicker } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function select(id: string) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await switchWorkspace(id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={{ gap: space.lg }}>
      <Wordmark size={24} />
      <View>
        <Title>{t('title')}</Title>
        <Body>{t('body')}</Body>
      </View>
      {failed ? <Notice tone="danger">{t('failed')}</Notice> : null}
      {workspaces.map((workspace, index) => (
        <ListRow
          key={workspace.id}
          title={workspace.name}
          subtitle={workspace.id === user?.workspace?.id ? t('current') : undefined}
          divider={index > 0}
          onPress={busy ? undefined : () => void select(workspace.id)}
        />
      ))}
      <Button variant="secondary" label={t('continue')} disabled={busy} onPress={closeWorkspacePicker} />
    </Screen>
  );
}
