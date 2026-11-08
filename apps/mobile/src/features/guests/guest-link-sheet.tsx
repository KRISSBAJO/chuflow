import * as Clipboard from 'expo-clipboard';
import { ScrollView } from 'react-native';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/kit';
import { toast } from '@/components/toast';
import { Caption, ErrorState, ListRow, Loading } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { getWorkspaceWebUrl } from '@/lib/api';
import type { BranchSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';

type PublicGuestForm = {
  _id: string;
  name: string;
  shareUrl?: string;
  branch?: { _id: string; status?: string };
};

export function GuestLinkSheet({ onClose }: { onClose: () => void }) {
  const t = useT('guests.list');
  const { user } = useSession();
  const workspace = user?.workspace?.id;
  const connectQuery = workspace && workspace !== 'winners-chapel-international' ? `?workspace=${encodeURIComponent(workspace)}` : '';
  const branches = useApi<BranchSummary[]>('/branches/options');
  const forms = useApi<PublicGuestForm[]>('/intake-templates/public/templates?kind=guest');
  const branchNames = new Map(branches.data?.map((branch) => [branch._id, branch.name]));
  const churchForms = (forms.data ?? []).flatMap((form) => {
    const branchName = form.branch && branchNames.get(form.branch._id);
    if (!branchName || !form.shareUrl || form.branch?.status !== 'active') return [];
    return [{ id: form._id, title: branchName, subtitle: form.name, url: form.shareUrl }];
  });
  const error = branches.error || forms.error;

  async function copy(url: string) {
    try {
      if (!(await Clipboard.setStringAsync(url))) {
        toast.error(t('copyFailed'));
        return;
      }
      toast.success(t('formCopied'));
      onClose();
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Sheet visible onClose={onClose} title={t('shareForm')}>
      <ScrollView contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
        <Caption>{t('shareFormHint')}</Caption>
        {branches.loading || forms.loading ? <Loading /> : null}
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              void branches.refresh();
              void forms.refresh();
            }}
          />
        ) : null}
        {churchForms.map((form) => (
          <ListRow key={form.id} title={form.title} subtitle={form.subtitle} left={<Icon name="copy" size={18} color={colors.flame} />} onPress={() => void copy(form.url)} />
        ))}
        <ListRow
          title={t('generalForm')}
          subtitle={t('generalFormHint')}
          left={<Icon name="copy" size={18} color={colors.flame} />}
          onPress={() => void copy(`${getWorkspaceWebUrl()}/connect${connectQuery}`)}
        />
      </ScrollView>
    </Sheet>
  );
}
