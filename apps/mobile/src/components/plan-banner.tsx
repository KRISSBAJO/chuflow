import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { usePlan } from '@/lib/entitlements';
import { useSession } from '@/lib/session';
import { Icon } from './icon';
import { Button } from './ui';

/*
 * Where the church's plan stands: a slim strip above every screen during a trial or a grace
 * period, a read-only notice when payment is overdue, and a full-screen stop when the
 * workspace is locked. Renders nothing when no plan is enforced.
 */
export function PlanGate({ children }: { children: ReactNode }) {
  const { entitlements, state } = usePlan();
  const { signOut } = useSession();
  const t = useT('common.plan');
  const more = useT('more');
  const format = useAppFormat();
  const insets = useSafeAreaInsets();
  if (!state || !entitlements) return <>{children}</>;

  if (state.kind === 'locked') {
    const why =
      state.reason === 'suspended'
        ? t('lockedSuspended')
        : state.reason === 'cancelled'
          ? t('lockedCancelled')
          : state.reason === 'trial_ended'
            ? t('lockedTrialEnded')
            : t('lockedOverdue');
    return (
      <View style={[styles.locked, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.lockBadge}>
          <Icon name="alert" size={26} color={colors.danger} strokeWidth={1.8} />
        </View>
        <Text style={styles.lockedTitle}>{t('lockedTitle')}</Text>
        <Text style={styles.lockedBody}>
          {why} {t('lockedBody')}
        </Text>
        <Button label={more('signOut')} variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  }

  const palette = state.kind === 'trial' ? { bg: colors.warningBg, fg: colors.warning } : state.kind === 'past_due' ? { bg: colors.flameSoft, fg: colors.flame } : { bg: colors.dangerBg, fg: colors.danger };
  const title =
    state.kind === 'trial'
      ? t('trialTitle', { days: state.days, plan: entitlements.planName })
      : state.kind === 'past_due'
        ? t('pastDueTitle', { plan: entitlements.planName })
        : t('readOnlyTitle');
  const body = state.kind === 'trial' ? t('trialBody') : state.kind === 'past_due' ? t('pastDueBody', { date: state.until ? format.date(state.until) : '' }) : t('readOnlyBody');

  return (
    <View style={{ flex: 1 }}>
      <View accessibilityRole="alert" style={[styles.strip, { backgroundColor: palette.bg, paddingTop: insets.top + space.sm }]}>
        <Icon name={state.kind === 'trial' ? 'clock' : 'alert'} size={16} color={palette.fg} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.stripTitle, { color: palette.fg }]}>{title}</Text>
          <Text style={[styles.stripBody, { color: palette.fg }]} numberOfLines={2}>
            {body}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.page,
    paddingBottom: space.sm,
  },
  stripTitle: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17 },
  stripBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, opacity: 0.9 },
  locked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xxl,
    backgroundColor: colors.page,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { ...type.display, textAlign: 'center' },
  lockedBody: { ...type.body, textAlign: 'center', marginBottom: space.sm },
});
