import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Field, Notice, Title } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { colors, fonts, space } from '@/constants/theme';
import { errorMessage } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useSession } from '@/lib/session';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't sign you in."));
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}
      >
        <Wordmark size={24} />

        <View style={styles.hero}>
          <Title style={styles.title}>Welcome back</Title>
          <Body style={styles.lead}>Sign in to your church&apos;s ChuFlow workspace.</Body>
        </View>

        <View style={styles.form}>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@church.org"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <View>
            <Field
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={{ paddingRight: 64 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((value) => !value)}
              style={styles.reveal}
              hitSlop={8}
            >
              <Text style={styles.revealText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Button label="Sign in" size="lg" loading={loading} onPress={() => void submit()} style={styles.submit} />

          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)}
            style={styles.forgot}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.flameLine} />
          <Text style={styles.footerText}>From Membership to Ministry</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, paddingHorizontal: space.page + 4, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { marginTop: 48 },
  title: { fontSize: 28, lineHeight: 33, letterSpacing: -0.8 },
  lead: { marginTop: 6, color: colors.muted },
  form: { marginTop: 32, gap: space.lg },
  reveal: { position: 'absolute', right: 12, bottom: 13 },
  revealText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  submit: { marginTop: space.sm },
  forgot: { alignSelf: 'center', padding: space.sm },
  forgotText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  footer: { marginTop: 'auto', paddingTop: 48, alignItems: 'center', gap: space.sm },
  flameLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: colors.flame },
  footerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint },
});
