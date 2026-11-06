import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type IconName } from '@/components/icon';
import { Sheet, SheetPicker } from '@/components/kit';
import { toast } from '@/components/toast';
import { Button, Caption, Chip, Field, Notice, Section, tap } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { AssigneePicker } from './assignee-picker';
import { useCareLabel } from './labels';
import { CARE_METHODS, CARE_OUTCOMES, CARE_STAGES, careId, careOwner, type CarePerson, type CareRecord } from './types';

export type CareUpdateKind = 'contact' | 'note' | 'task' | 'stage' | 'owner';

const METHOD_ICONS: Record<(typeof CARE_METHODS)[number], IconName> = {
  phone: 'phone',
  whatsapp: 'whatsapp',
  text: 'message',
  email: 'mail',
  in_person: 'user',
  administrative: 'clipboard',
};

const REMINDERS: { key: 'none' | 'tomorrow' | 'threeDays' | 'week' | 'twoWeeks'; days: number | null }[] = [
  { key: 'none', days: null },
  { key: 'tomorrow', days: 1 },
  { key: 'threeDays', days: 3 },
  { key: 'week', days: 7 },
  { key: 'twoWeeks', days: 14 },
];

type Props = {
  record: CareRecord;
  onClose: () => void;
  onSaved: (next: CareRecord) => void;
  initialKind?: CareUpdateKind;
  /** Preselects how they were reached after a quick action (call, WhatsApp…). */
  initialMethod?: string;
  /** Opens straight onto completing this task. */
  taskId?: string;
};

/**
 * "Log activity" for a care record: a conversation or note, a next step, a stage change, or (for
 * leadership) a change of owner. Each one is a PATCH /care/cases/:id with the matching operation.
 * The form mounts fresh each time the sheet opens.
 */
export function CareUpdateSheet({ visible, ...props }: Props & { visible: boolean }) {
  if (!visible) return null;
  return <UpdateForm {...props} />;
}

function UpdateForm({ record, onClose, onSaved, initialKind = 'contact', initialMethod, taskId }: Props) {
  const t = useT('care.update');
  const label = useCareLabel();
  const format = useAppFormat();

  const [kind, setKind] = useState<CareUpdateKind>(record.stopContact && initialKind === 'contact' ? 'note' : initialKind);
  const [outcome, setOutcome] = useState<string>('contacted');
  const [method, setMethod] = useState<string>(initialMethod ?? 'phone');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'team' | 'pastoral'>('team');
  const [task, setTask] = useState<string>(taskId ?? '');
  const [reminder, setReminder] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [dueDays, setDueDays] = useState<number>(3);
  const [unitId, setUnitId] = useState('');
  const [stage, setStage] = useState(record.stage);
  const [owner, setOwner] = useState<CarePerson | null>(() => careOwner(record.ownerId) ?? record.people.find((person) => person._id === careId(record.ownerId)) ?? null);
  const [backup, setBackup] = useState<CarePerson | null>(() => record.people.find((person) => person._id === record.backupId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openTasks = record.tasks.filter((item) => item.status === 'open');
  const kinds: CareUpdateKind[] = ['contact', 'note', 'task', 'stage', ...(record.isAdmin ? (['owner'] as CareUpdateKind[]) : [])];
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  async function save() {
    const text = note.trim();
    let body: Record<string, unknown>;
    if (kind === 'contact') {
      if (!text) return setError(t('noteRequired'));
      body = {
        operation: 'contact',
        outcome,
        method,
        note: text,
        visibility,
        ...(task ? { taskId: task } : {}),
        ...(reminder ? { nextActionAt: inDays(reminder) } : {}),
      };
    } else if (kind === 'note') {
      if (!text) return setError(t('noteRequired'));
      body = { operation: 'note', note: text, visibility };
    } else if (kind === 'task') {
      if (!title.trim()) return setError(t('titleRequired'));
      body = { operation: 'task', title: title.trim(), nextActionAt: inDays(dueDays), ...(unitId ? { serviceUnitId: unitId } : {}) };
    } else if (kind === 'stage') {
      body = { operation: 'journey', stage };
    } else {
      body = { operation: 'assign', userId: owner?._id ?? null, backupId: backup?._id ?? null };
    }
    setSaving(true);
    setError(null);
    try {
      const next = await api.patch<CareRecord>(`/care/cases/${record._id}`, { expectedRevision: record.revision, ...body });
      toast.success(kind === 'owner' ? t('ownerSaved') : t('saved'));
      onSaved(next);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }

  return (
    <Sheet visible onClose={() => (saving ? undefined : onClose())} title={t('title')} footer={<Button label={t('save')} size="lg" loading={saving} onPress={() => void save()} />}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}>
          <View style={styles.chips}>
            {kinds.map((option) => (
              <Chip key={option} label={t(`kinds.${option}`)} selected={kind === option} onPress={() => setKind(option)} />
            ))}
          </View>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          {kind === 'contact' ? (
            <>
              <View style={styles.group}>
                <Section title={t('outcome')} />
                <View style={styles.chips}>
                  {CARE_OUTCOMES.map((option) => (
                    <Chip key={option} label={label(option)} selected={outcome === option} onPress={() => setOutcome(option)} />
                  ))}
                </View>
              </View>
              <View style={styles.group}>
                <Section title={t('method')} />
                <View style={styles.chips}>
                  {CARE_METHODS.map((option) => (
                    <Chip key={option} label={label(option)} icon={METHOD_ICONS[option]} selected={method === option} onPress={() => setMethod(option)} />
                  ))}
                </View>
                <Caption>{t('staffNote')}</Caption>
              </View>
            </>
          ) : null}

          {kind === 'contact' || kind === 'note' ? (
            <>
              <Field label={t('note')} required value={note} onChangeText={setNote} placeholder={t('notePlaceholder')} multiline maxLength={5000} />
              <View style={styles.group}>
                <Section title={t('visibility')} />
                <View style={styles.chips}>
                  <Chip label={t('team')} selected={visibility === 'team'} onPress={() => setVisibility('team')} />
                  <Chip label={t('pastoral')} icon="lock" selected={visibility === 'pastoral'} onPress={() => setVisibility('pastoral')} />
                </View>
              </View>
            </>
          ) : null}

          {kind === 'contact' && openTasks.length ? (
            <SheetPicker
              label={t('completeTask')}
              value={task || 'none'}
              options={[{ value: 'none', label: t('conversationOnly') }, ...openTasks.map((item) => ({ value: item._id, label: item.title, hint: `${t('due')} · ${format.shortDate(item.dueAt)}` }))]}
              onChange={(value) => setTask(value === 'none' ? '' : value)}
            />
          ) : null}

          {kind === 'contact' ? (
            <View style={styles.group}>
              <Section title={t('nextAction')} />
              <View style={styles.chips}>
                {REMINDERS.map((option) => (
                  <Chip key={option.key} label={t(`reminders.${option.key}`)} selected={reminder === option.days} onPress={() => setReminder(option.days)} />
                ))}
              </View>
            </View>
          ) : null}

          {kind === 'task' ? (
            <>
              <Field label={t('taskTitle')} required value={title} onChangeText={setTitle} placeholder={t('taskPlaceholder')} maxLength={200} />
              <View style={styles.group}>
                <Section title={t('due')} />
                <View style={styles.chips}>
                  {REMINDERS.filter((option) => option.days).map((option) => (
                    <Chip key={option.key} label={t(`reminders.${option.key}`)} selected={dueDays === option.days} onPress={() => setDueDays(option.days!)} />
                  ))}
                </View>
              </View>
              {record.units.length ? (
                <SheetPicker
                  label={t('groupIntro')}
                  value={unitId || 'none'}
                  options={[{ value: 'none', label: t('otherAction') }, ...record.units.map((unit) => ({ value: unit._id, label: unit.name }))]}
                  onChange={(value) => setUnitId(value === 'none' ? '' : value)}
                />
              ) : null}
            </>
          ) : null}

          {kind === 'stage' ? (
            <View>
              <Section title={t('stage')} />
              {CARE_STAGES.map((option, index) => {
                const selected = stage === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      tap();
                      setStage(option);
                    }}
                    style={[styles.option, index > 0 && styles.divider]}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                    <Text style={[type.label, { flex: 1 }]}>{label(option)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {kind === 'owner' ? (
            <>
              <AssigneePicker label={t('owner')} branchId={careId(record.branchId)} value={owner} onChange={setOwner} />
              <AssigneePicker label={t('backup')} branchId={careId(record.branchId)} value={backup} onChange={setBackup} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { gap: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#c9c6bf', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ink },
});
