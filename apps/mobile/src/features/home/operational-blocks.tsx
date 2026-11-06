import { StyleSheet, View } from 'react-native';
import { Avatar, Badge, Caption, EmptyState, ListRow, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useAppFormat } from '@/i18n/format';
import { useT } from '@/i18n/provider';
import { branchName, statusTone } from '@/lib/format';
import { BarRow } from './bars';
import { STAGE_ORDER, type AttendanceMixRow, type MemberListItem, type PipelineStage } from './types';

/*
 * The live-activity blocks of the website dashboard (follow-up pipeline, attendance by service,
 * newest members). The API sends them for district and branch scopes.
 */

/** One flame hue, light to dark, the website's ordinal ramp for the follow-up stages. */
const STAGE_RAMP = ['#f2a35e', '#e0823a', '#c96727', '#ad501b', '#8f3e14', '#70300f', '#52230a'];

export function FollowUpPipeline({ pipeline, onOpen }: { pipeline: PipelineStage[]; onOpen?: () => void }) {
  const t = useT('home.pipeline');
  const tc = useT('common');
  const format = useAppFormat();
  const stages = [...pipeline].sort((left, right) => {
    const a = STAGE_ORDER.indexOf(left.status);
    const b = STAGE_ORDER.indexOf(right.status);
    return (a === -1 ? 99 : a) - (b === -1 ? 99 : b);
  });
  const total = stages.reduce((sum, stage) => sum + stage.total, 0);

  return (
    <View>
      <Section title={t('title')} action={onOpen ? tc('actions.open') : undefined} onAction={onOpen} />
      {total > 0 ? (
        <>
          <Caption style={styles.lead}>{t('inCare', { count: total })}</Caption>
          {stages.map((stage, index) => (
            <BarRow
              key={stage.status}
              divider={index > 0}
              swatch={STAGE_RAMP[STAGE_ORDER.indexOf(stage.status)] ?? STAGE_RAMP[index % STAGE_RAMP.length]}
              title={format.status(stage.status)}
              value={format.number(stage.total)}
              share={stage.total / total}
              trailing={`${Math.round((stage.total / total) * 100)}%`}
            />
          ))}
        </>
      ) : (
        <EmptyState icon="care" title={t('empty')} />
      )}
    </View>
  );
}

export function AttendanceMix({ mix, onOpen }: { mix: AttendanceMixRow[]; onOpen?: () => void }) {
  const t = useT('home.attendance');
  const tc = useT('common');
  const format = useAppFormat();
  const services = [...mix].sort((left, right) => right.totalPeople - left.totalPeople);
  const max = Math.max(1, ...services.map((service) => service.totalPeople));

  return (
    <View>
      <Section title={t('title')} action={onOpen ? tc('actions.open') : undefined} onAction={onOpen} />
      {services.length ? (
        services.map((service, index) => (
          <BarRow
            key={service._id}
            divider={index > 0}
            title={format.status(service._id)}
            value={format.number(service.totalPeople)}
            share={service.totalPeople / max}
            caption={t('summary', {
              firstTimers: format.number(service.firstTimers),
              converts: format.number(service.newConverts),
              reports: format.number(service.summarySubmissions),
            })}
          />
        ))
      ) : (
        <EmptyState icon="attendance" title={t('empty')} />
      )}
    </View>
  );
}

export function NewestMembers({ members, onSeeAll, onOpen }: { members: MemberListItem[]; onSeeAll?: () => void; onOpen?: (id: string) => void }) {
  const t = useT('home.newestMembers');
  const tc = useT('common');
  const format = useAppFormat();

  return (
    <View>
      <Section title={t('title')} action={members.length && onSeeAll ? tc('actions.seeAll') : undefined} onAction={onSeeAll} />
      {members.length ? (
        members.slice(0, 3).map((member, index) => (
          <ListRow
            key={member._id}
            divider={index > 0}
            title={[member.title, format.fullName(member)].filter(Boolean).join(' ')}
            subtitle={[branchName(member.branchId), format.relativeTime(member.createdAt)].filter(Boolean).join(' · ')}
            left={<Avatar person={member} size={30} />}
            right={member.membershipStatus ? <Badge label={format.status(member.membershipStatus)} tone={statusTone(member.membershipStatus)} /> : undefined}
            chevron={false}
            onPress={onOpen ? () => onOpen(member._id) : undefined}
          />
        ))
      ) : (
        <EmptyState icon="members" title={t('empty')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: space.sm, marginBottom: 2 },
});
