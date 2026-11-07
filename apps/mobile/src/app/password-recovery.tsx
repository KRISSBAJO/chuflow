import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageButton } from '@/components/language-picker';
import { Body, Button, Field, Notice, Title } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { colors, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, ApiError } from '@/lib/api';
import { WEB_URL } from '@/lib/config';

function readResetToken(value: string): string | null {
  try {
    const link = new URL(value.trim());
    const site = new URL(WEB_URL);
    const host = (url: URL) => url.hostname.replace(/^www\./i, '');
    if (host(link) !== host(site) || link.port !== site.port || link.protocol !== site.protocol || link.pathname.replace(/\/$/, '') !== '/reset-password') return null;
    const token = link.searchParams.get('token');
    return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
  } catch {
    return null;
  }
}

export default function PasswordRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const t = useT('auth.recovery');
  const signIn = useT('auth.signIn');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function switchStep(next: 'request' | 'reset') {
    setError('');
    setLink('');
    setPassword('');
    setConfirmation('');
    setStep(next);
  }

  async function sendEmail() {
    if (busy) return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(t('invalidEmail'));
      return;
    }
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await api.post('/auth/forgot-password', { email: address });
      setSent(true);
    } catch {
      setError(t('sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy) return;
    const token = readResetToken(link);
    if (!token) {
      setError(t('invalidLink'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordLength'));
      return;
    }
    if (password !== confirmation) {
      setError(t('passwordMismatch'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setLink('');
      setPassword('');
      setConfirmation('');
      setStep('done');
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 400 ? t('expiredLink') : t('resetFailed'));
    } finally {
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
          <Title>{t(step === 'request' ? 'requestTitle' : step === 'reset' ? 'resetTitle' : 'doneTitle')}</Title>
          <Body style={styles.lead}>{t(step === 'request' ? 'requestHint' : step === 'reset' ? 'resetHint' : 'doneHint')}</Body>
        </View>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {step === 'request' ? (
          <>
            {sent ? <Notice tone="success">{t('sent')}</Notice> : null}
            <Field
              label={signIn('email')}
              placeholder={signIn('emailPlaceholder')}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setSent(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => void sendEmail()}
            />
            <Button label={t(sent ? 'sendAgain' : 'send')} icon="mail" loading={busy} onPress={() => void sendEmail()} />
            <Button label={t('haveLink')} variant="secondary" disabled={busy} onPress={() => switchStep('reset')} />
          </>
        ) : null}

        {step === 'reset' ? (
          <>
            <Field
              label={t('link')}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="url"
              secureTextEntry
              editable={!busy}
            />
            <Field
              label={t('password')}
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
            />
            <Button label={t('save')} loading={busy} onPress={() => void resetPassword()} />
            <Button label={t('requestAgain')} variant="secondary" disabled={busy} onPress={() => switchStep('request')} />
          </>
        ) : null}

        <Button label={t('back')} variant={step === 'done' ? 'primary' : 'ghost'} disabled={busy} onPress={() => router.replace('/sign-in')} />
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
