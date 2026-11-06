import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, EmptyState, Field, Loading, Notice, Screen, tap } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/use-api';
import { setPendingScan } from './scan-bus';
import { KIDS, kidsHref } from './shared';
import type { ChildrenOverview } from './types';

/**
 * Camera QR scanner for family cards and pickup receipts. With `sessionId` it hands the code back
 * to the desk underneath; without one it finds the open session first. On the web (and when the
 * camera is refused) a text box takes the code instead.
 */
export function ScanScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; tab?: string }>();
  const t = useT('kids.scan');
  const tc = useT('common.actions');
  const tq = useT('kids.home.quiet');
  const { user } = useSession();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const handled = useRef(false);
  const target: 'checkin' | 'pickup' = params.tab === 'pickup' ? 'pickup' : 'checkin';

  // Without a session the overview tells us which one is open.
  const overview = useApi<ChildrenOverview>(params.sessionId ? null : '/children');
  const sessionId = params.sessionId || overview.data?.live?._id || '';
  const web = Platform.OS === 'web';

  function deliver(code: string) {
    const value = code.trim();
    if (!value || handled.current || !sessionId) return;
    handled.current = true;
    tap('success');
    toast.success(t('scanned'));
    if (params.sessionId && router.canGoBack()) {
      setPendingScan({ sessionId, tab: target, code: value });
      router.back();
    } else {
      router.replace(kidsHref(`/kids/sessions/${sessionId}`, { tab: target, code: value }));
    }
  }

  const manualBox = (
    <View style={{ gap: space.sm }}>
      <Field label={t('manualLabel')} value={manual} onChangeText={setManual} placeholder={t('manualPlaceholder')} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={() => deliver(manual)} autoFocus={web} />
      <Button label={t('use')} disabled={!manual.trim() || !sessionId} onPress={() => deliver(manual)} />
    </View>
  );

  if (!params.sessionId && !overview.data) {
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        {overview.loading ? <Loading /> : <Notice tone="danger">{overview.error}</Notice>}
      </Screen>
    );
  }

  if (!sessionId) {
    const supervise = can.kidsSupervise(user?.role);
    return (
      <Screen safeTop={false}>
        <Stack.Screen options={{ title: t('title') }} />
        <EmptyState
          icon="door"
          title={t('noSession')}
          body={t('noSessionBody')}
          action={supervise ? <Button label={tq('cta')} onPress={() => router.replace(kidsHref('/kids/sessions/new'))} /> : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen safeTop={false}>
      <Stack.Screen options={{ title: t('title') }} />
      <Caption>{target === 'pickup' ? t('pickupHint') : t('hint')}</Caption>

      {web ? (
        <>
          <Notice tone="info">{t('webHint')}</Notice>
          {manualBox}
        </>
      ) : !permission ? (
        <Loading />
      ) : !permission.granted ? (
        <>
          <EmptyState
            icon="camera"
            title={t('permissionTitle')}
            body={permission.canAskAgain ? t('permissionBody') : t('settings')}
            action={
              permission.canAskAgain ? (
                <Button label={t('allow')} icon="camera" onPress={() => void requestPermission()} />
              ) : (
                <Button label={tc('open')} variant="secondary" onPress={() => void Linking.openSettings()} />
              )
            }
          />
          {manualBox}
        </>
      ) : (
        <>
          <View style={styles.frame}>
            {focused ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => deliver(data)}
              />
            ) : null}
            <View pointerEvents="none" style={styles.reticle} />
          </View>
          <Text style={[type.small, { textAlign: 'center' }]}>{t('hint')}</Text>
          {manualBox}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: '62%', aspectRatio: 1, borderWidth: 2, borderColor: KIDS.amber, borderRadius: radius.lg, opacity: 0.9 },
});
