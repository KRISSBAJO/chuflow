import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Caption, Field } from '@/components/ui';
import { toast } from '@/components/toast';
import { colors, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export function AccountDeletion() {
  const { user, signOut } = useSession();
  const t = useT('more');
  const common = useT('common');
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');

  async function submit() {
    if (pending || !password) return;
    setPending(true);
    setState('idle');
    try {
      await api.post('/auth/account-deletion', { password });
      setState('sent');
      toast.success(t('accountDeletion.received'));
      await signOut();
    } catch {
      setState('error');
    } finally {
      setPassword('');
      setPending(false);
    }
  }

  if (!open) {
    return <Button variant="secondary" label={t('accountDeletion.title')} onPress={() => setOpen(true)} />;
  }

  return (
    <View style={styles.form}>
      {state === 'sent' ? (
        <View accessibilityLiveRegion="polite"><Caption>{t('accountDeletion.received')}</Caption></View>
      ) : (
        <>
          {user?.workspace?.name ? <Caption>{user.workspace.name}</Caption> : null}
          <Caption>{t('accountDeletion.body')}</Caption>
          <Field
            label={t('accountDeletion.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            maxLength={128}
            editable={!pending}
          />
          {state === 'error' ? (
            <View accessibilityLiveRegion="polite"><Caption style={styles.error}>{t('accountDeletion.error')}</Caption></View>
          ) : null}
          <Button label={t('accountDeletion.submit')} loading={pending} disabled={!password} onPress={() => void submit()} />
          <Button variant="secondary" label={common('actions.cancel')} disabled={pending} onPress={() => {
            setOpen(false);
            setPassword('');
            setState('idle');
          }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.sm },
  error: { color: colors.danger },
});
