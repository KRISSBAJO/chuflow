import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Field } from '@/components/ui';
import { space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { parseAmount } from './shared';

/** Inline correction of an entry's amount and notes, the two fields a phone edit realistically needs. */
export function AmountNotesEditor({
  amount,
  notes,
  saving,
  saveLabel,
  onSave,
  onCancel,
}: {
  amount: number;
  notes?: string;
  saving: boolean;
  saveLabel: string;
  onSave: (next: { amount: number; notes?: string }) => void;
  onCancel: () => void;
}) {
  const t = useT('finance');
  const tc = useT('common.actions');
  const [amountText, setAmountText] = useState(String(amount));
  const [notesText, setNotesText] = useState(notes ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = parseAmount(amountText);
    if (!(parsed > 0)) {
      setError(t('offeringForm.errors.amount'));
      return;
    }
    setError(null);
    onSave({ amount: parsed, notes: notesText.trim() || undefined });
  }

  return (
    <View style={styles.editor}>
      <Field label={t('fields.amount')} required value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" inputMode="decimal" error={error} style={styles.amount} />
      <Field label={t('fields.notes')} value={notesText} onChangeText={setNotesText} multiline />
      <View style={styles.actions}>
        <Button label={tc('cancel')} variant="secondary" style={{ flex: 1 }} disabled={saving} onPress={onCancel} />
        <Button label={saveLabel} icon="check" style={{ flex: 1.4 }} loading={saving} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: space.lg },
  amount: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm },
});
