import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Body, Button, Notice, Screen, tap } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { colors, radius, space, type } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { useSession } from '@/lib/session';

export default function ChooseWorkspaceScreen() {
  const t = useT('auth.workspacePicker');
  const { user, workspaces, switchWorkspace, closeWorkspacePicker } = useSession();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const currentId = user?.workspace?.id;

  async function select(id: string) {
    if (pendingId) return;
    tap();
    setPendingId(id);
    setFailed(false);
    try {
      await switchWorkspace(id);
    } catch {
      setFailed(true);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <Button size="lg" label={t('continue')} icon="arrowRight" disabled={pendingId !== null} onPress={closeWorkspacePicker} style={styles.continue} />
        </View>
      }
    >
      <View style={styles.brand}>
        <Wordmark size={24} />
      </View>
      <View style={styles.intro}>
        <View style={styles.introIcon} accessible={false}>
          <Icon name="building" size={23} color={colors.warning} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{t('title')}</Text>
        <Body style={styles.description}>{t('body')}</Body>
      </View>
      {failed ? <Notice tone="danger">{t('failed')}</Notice> : null}
      <View style={styles.list}>
        {workspaces.map((workspace) => {
          const current = workspace.id === currentId;
          const pending = pendingId === workspace.id;
          const initials = workspace.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase();

          return (
            <PressableScale
              key={workspace.id}
              accessibilityRole="button"
              accessibilityLabel={current ? `${workspace.name}, ${t('current')}` : workspace.name}
              accessibilityState={{ selected: current, busy: pending, disabled: pendingId !== null }}
              disabled={pendingId !== null}
              scaleTo={0.985}
              onPress={current ? closeWorkspacePicker : () => void select(workspace.id)}
              style={[styles.workspace, current && styles.currentWorkspace]}
            >
              <View style={[styles.monogram, current && styles.currentMonogram]}>
                <Text style={[styles.initials, current && styles.currentInitials]}>{initials}</Text>
              </View>
              <View style={styles.workspaceText}>
                <Text style={styles.workspaceName}>{workspace.name}</Text>
                {current ? <Text style={styles.currentLabel}>{t('current')}</Text> : null}
              </View>
              <View style={styles.indicator}>
                {pending ? <ActivityIndicator size="small" color={colors.flame} /> : (
                  <Icon name={current ? 'check' : 'arrowRight'} size={17} color={current ? colors.warning : colors.ink} />
                )}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.xl, width: '100%', maxWidth: 520, alignSelf: 'center' },
  brand: { paddingBottom: space.sm },
  intro: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  introIcon: {
    width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.flameSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.xs,
  },
  title: { ...type.display, fontSize: 27, lineHeight: 33, letterSpacing: -0.8 },
  description: { ...type.body, color: colors.muted },
  list: { gap: space.md },
  workspace: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 74,
    padding: space.md, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.lg,
    backgroundColor: colors.inset,
  },
  currentWorkspace: { backgroundColor: colors.flameSoft, borderColor: '#f5d6bd' },
  monogram: {
    width: 44, height: 44, borderRadius: radius.md, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.surfaceStrong,
  },
  currentMonogram: { backgroundColor: colors.inset },
  initials: { ...type.title, color: colors.text },
  currentInitials: { color: colors.warning },
  workspaceText: { flex: 1, minWidth: 0, gap: 2 },
  workspaceName: { ...type.title },
  currentLabel: { ...type.small, color: colors.warning },
  indicator: { width: 30, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  footer: { width: '100%', maxWidth: 484, alignSelf: 'center' },
  continue: { borderRadius: radius.lg },
});
