import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageButton } from '@/components/language-picker';
import { Body, Button, Field, Notice, Title } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { colors, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/*
 * The first admin of a provisioned church signs in with a generated password the operator has
 * seen; this screen makes them choose their own before the app opens.
 */
export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const t = useT('auth.firstPassword');
  const { user, changeInitialPassword, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    if (!current) return setError(t('missingCurrent'));
    if (password.length < 8) return setError(t('passwordLength'));
    if (password !== confirmation) return setError(t('mismatch'));
    if (password === current) return setError(t('same'));
    setBusy(true);
    setError('');
    try {
      await changeInitialPassword(current, password);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? t('wrongCurrent') : errorMessage(caught, t('failed')));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.topRow}>
          <Wordmark size={24} />
          <LanguageButton />
        </View>
        <View style={styles.heading}>
          <Title>{t('title')}</Title>
          <Body style={styles.lead}>{t('lead', { workspace: user?.workspace?.name ?? 'ChuFlow' })}</Body>
        </View>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Field
          label={t('current')}
          value={current}
          onChangeText={setCurrent}
          autoComplete="current-password"
          textContentType="password"
          secureTextEntry
          editable={!busy}
        />
        <Field
          label={t('new')}
          hint={t('passwordLength')}
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry
          editable={!busy}
        />
        <Field
          label={t('confirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          autoComplete="new-password"
          textContentType="newPassword"
          secureTextEntry
          editable={!busy}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <Button label={t('submit')} size="lg" loading={busy} onPress={() => void submit()} />
        <Button label={t('signOut')} variant="ghost" disabled={busy} onPress={() => void signOut()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, paddingHorizontal: space.page + 4, maxWidth: 480, width: '100%', alignSelf: 'center', gap: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  heading: { marginTop: space.xl, gap: space.sm },
  lead: { color: colors.muted },
});
