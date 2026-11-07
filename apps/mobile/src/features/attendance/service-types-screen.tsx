import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from '@/components/toast';
import { Badge, Button, Caption, EmptyState, ErrorState, Field, Loading, Screen, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useT } from '@/i18n/provider';
import { api, errorMessage, query } from '@/lib/api';
import { canManageLocalServiceTypes } from '@/lib/permissions';
import { useSession, userBranchId } from '@/lib/session';
import type { ServiceType } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export function ServiceTypesScreen() {
  const t = useT('attendance.serviceTypes');
  const { user } = useSession();
  const branchId = userBranchId(user);
  const allowed = canManageLocalServiceTypes(user?.role) && !!branchId;
  const list = useApi<ServiceType[]>(allowed ? `/service-types${query({ branchId })}` : null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(service?: ServiceType) {
    if (!allowed || busy || (!service && !name.trim())) return;
    setBusy(true);
    try {
      const saved = service
        ? await api.patch<ServiceType>(`/service-types/${service._id}`, { isActive: !service.isActive })
        : await api.post<ServiceType>('/service-types', { branchId, name: name.trim() });
      list.setData((current) =>
        [...(current ?? []).filter((item) => item._id !== saved._id), saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (!service) setName('');
      toast.success(t('saved'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen safeTop={false} contentStyle={{ gap: space.md }}>
      <Stack.Screen options={{ title: t('title') }} />
      {allowed ? (
        <>
          <Caption>{t('hint')}</Caption>
          <Field label={t('name')} value={name} onChangeText={setName} editable={!busy} maxLength={100} />
          <Button label={t('add')} icon="plus" disabled={busy || list.loading || !name.trim()} onPress={() => void save()} />
          {list.loading ? <Loading /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null}
          {list.data?.length === 0 ? <EmptyState icon="calendar" title={t('empty')} /> : null}
          {list.data?.map((service) => (
            <View key={service._id} style={{ gap: space.sm }}>
              <Section title={service.name} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                <Badge label={t(service.isActive ? 'active' : 'inactive')} />
                <Button
                  label={t(service.isActive ? 'deactivate' : 'activate')}
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onPress={() => void save(service)}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        <EmptyState icon="lock" title={t('title')} />
      )}
    </Screen>
  );
}
