import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { KeyValue } from '@/components/kit';
import { Badge, Button, Caption, Notice, Screen, Section } from '@/components/ui';
import { colors, fonts, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { WEB_URL } from '@/lib/config';
import { downloadCompatibleUpdate, newerRelease, parseRelease, type Release } from './update-policy';

export function AppUpdatesScreen() {
  const t = useT('more.updates');
  const format = useAppFormat();
  const state = Updates.useUpdates();
  const isInstalled = Application.applicationId === 'com.chuflow.app';
  const version = isInstalled ? (Application.nativeApplicationVersion ?? '') : (Constants.expoConfig?.version ?? '');
  const build = isInstalled ? (Application.nativeBuildVersion ?? '0') : '0';
  const enabled = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Date>();
  const [smallStatus, setSmallStatus] = useState<'current' | 'ready' | 'unavailable'>();
  const [release, setRelease] = useState<Release>();
  const [nativeChecked, setNativeChecked] = useState(false);
  const [smallError, setSmallError] = useState(false);
  const [nativeError, setNativeError] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const pending = state.isUpdatePending || smallStatus === 'ready';
  const nativeAvailable = release && isInstalled && newerRelease(release, version, build);
  const working = busy || state.isChecking || state.isDownloading || state.isRestarting || state.isStartupProcedureRunning;

  async function checkNative() {
    if (Platform.OS === 'web') return;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(`${WEB_URL}/mobile-release.json`, { credentials: 'omit', cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error('Release unavailable');
      const data = (await response.json()) as { schemaVersion?: number; ios?: unknown; android?: unknown };
      if (data.schemaVersion !== 1) throw new Error('Unsupported release information');
      setRelease(parseRelease(Platform.OS === 'ios' ? data.ios : data.android));
      setNativeChecked(true);
    } finally {
      clearTimeout(timeout);
    }
  }
  async function check() {
    setBusy(true);
    setSmallError(false);
    setNativeError(false);
    const results = await Promise.allSettled([downloadCompatibleUpdate({ enabled, check: Updates.checkForUpdateAsync, fetch: Updates.fetchUpdateAsync }), checkNative()]);
    if (results[0].status === 'fulfilled') setSmallStatus(results[0].value);
    else setSmallError(true);
    if (results[1].status === 'rejected') setNativeError(true);
    setChecked(new Date());
    setBusy(false);
  }
  async function apply() {
    setBusy(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setSmallError(true);
      setBusy(false);
      setRestartConfirm(false);
    }
  }
  async function openApp() {
    if (!release) return;
    try {
      if (Platform.OS === 'ios' && release.kind === 'testflight' && (await Linking.canOpenURL('itms-beta://'))) await Linking.openURL('itms-beta://');
      else await Linking.openURL(release.url);
    } catch {
      setNativeError(true);
    }
  }
  const status = state.isDownloading
    ? 'downloading'
    : state.isChecking || busy
      ? 'checking'
      : pending
        ? 'ready'
        : smallError
          ? 'failed'
          : !enabled
            ? 'unavailable'
            : smallStatus === 'current'
              ? 'current'
              : 'notChecked';
  return (
    <Screen safeTop={false} contentStyle={{ gap: space.lg }}>
      <Stack.Screen options={{ title: t('title') }} />
      <View style={{ gap: space.sm, paddingVertical: space.sm }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.flameSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="refresh" size={24} color="#a83e0a" />
        </View>
        <Text style={type.display}>{t('title')}</Text>
        <Caption>{t('hint')}</Caption>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>
          {t('version')} {version} {isInstalled ? `· ${t('build')} ${build}` : ''}
        </Text>
      </View>
      <Section title={t('smallTitle')} />
      <Caption>{t('smallBody')}</Caption>
      <Notice tone={smallError ? 'danger' : pending ? 'success' : 'info'} icon={smallError ? 'alert' : pending ? 'checkCircle' : 'info'}>
        {t(status)}
      </Notice>
      {state.isDownloading && state.downloadProgress !== undefined ? <Caption>{format.number(state.downloadProgress * 100, { maximumFractionDigits: 0 })}%</Caption> : null}
      {pending && enabled ? <Button label={t('apply')} icon="refresh" disabled={working} onPress={() => setRestartConfirm(true)} /> : null}
      {restartConfirm ? (
        <View style={{ gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: 16 }}>
          <Text style={type.title}>{t('restartTitle')}</Text>
          <Caption>{t('restartBody')}</Caption>
          <Button label={t('restart')} loading={state.isRestarting} disabled={busy} onPress={() => void apply()} />
          <Button label={t('cancel')} variant="secondary" disabled={busy} onPress={() => setRestartConfirm(false)} />
        </View>
      ) : null}
      <Button label={t('check')} icon="refresh" loading={working} disabled={working} onPress={() => void check()} />
      <Caption>
        {t('lastChecked')}: {checked ? format.dateTime(checked) : t('notChecked')}
      </Caption>
      <Section title={t('nativeTitle')} />
      <Caption>{t('nativeBody')}</Caption>
      {nativeError ? <Notice tone="warning">{t('nativeFailed')}</Notice> : null}
      {nativeAvailable ? (
        <View style={{ gap: space.md }}>
          <Badge label={`${release.version} (${release.build})`} tone="flame" />
          <Button label={t(release.kind === 'testflight' ? 'openTestFlight' : 'getApp')} icon="arrowUpRight" onPress={() => void openApp()} />
        </View>
      ) : nativeChecked && !nativeError && isInstalled ? (
        <Caption>{t('nativeCurrent')}</Caption>
      ) : null}
      <Section title={t('details')} />
      <KeyValue
        rows={[
          { label: t('version'), value: version },
          { label: t('build'), value: isInstalled ? build : '—' },
          { label: t('details'), value: !enabled ? '—' : state.currentlyRunning.isEmbeddedLaunch ? t('embedded') : t('updated') },
        ]}
      />
    </Screen>
  );
}
