import { useState } from 'react';
import { View } from 'react-native';
import { toast } from '@/components/toast';
import { Button, Caption, Field } from '@/components/ui';
import { space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage } from '@/lib/api';
import { useAlerts } from '@/lib/alerts';

export function FinanceReviewControls({
  id,
  kind = 'offerings',
  status,
  canReview,
  revision,
  onReviewed,
}: {
  id: string;
  kind?: 'offerings' | 'expenses';
  status?: string;
  canReview?: boolean;
  revision?: number;
  onReviewed: () => void;
}) {
  const t = useT('finance.review');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh } = useAlerts();
  if (status !== 'submitted') return null;
  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    try {
      await api.patch(`/finance/${kind}/${id}/${decision}`, { notes, reviewRevision: revision });
      toast.success(t(decision === 'approve' ? 'approved' : 'rejected'));
      onReviewed();
      void refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: space.md }}>
      <Caption>{t('independent')}</Caption>
      {canReview ? (
        <>
          <Field label={t('notes')} value={notes} onChangeText={setNotes} multiline />
          <Button label={t('approve')} disabled={busy} onPress={() => void decide('approve')} />
          <Button label={t('reject')} variant="secondary" disabled={busy} onPress={() => void decide('reject')} />
        </>
      ) : null}
    </View>
  );
}
