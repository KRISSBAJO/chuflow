import { View } from 'react-native';
import { Chip, Field, Section } from '@/components/ui';
import { space } from '@/constants/theme';
import { useI18n, useT } from '@/i18n/provider';
import type { StaffGuestForm } from '@/features/guests/staff-guest-form';

export type MemberFormDefinition = StaffGuestForm & { values?: Record<string, string | number> };
type Values = Record<string, string | number>;

export function memberFormPayload(form: MemberFormDefinition, values: Values) {
  return {
    formRevision: form.revision,
    customFields: Object.fromEntries(form.fields.map((field) => {
      const value = values[field.key] ?? form.values?.[field.key] ?? '';
      return [field.key, field.type === 'number' && String(value).trim() ? Number(value) : value];
    })),
  };
}

export function CustomMemberFields({ form, values, onChange, title }: {
  form?: MemberFormDefinition;
  values: Values;
  onChange: (values: Values) => void;
  title?: string;
}) {
  const t = useT('members.form');
  const { locale } = useI18n();
  if (!form?.fields.length) return null;
  return (
    <View style={{ gap: space.md }}>
      <Section title={title ?? t('customAnswers')} />
      {form.fields.map((field) => {
        const label = (locale === 'es' && field.labelEs) || (locale === 'fr' && field.labelFr) || (locale === 'pt' && field.labelPt) || field.label;
        const value = String(values[field.key] ?? form.values?.[field.key] ?? '');
        const change = (answer: string) => onChange({ ...values, [field.key]: answer });
        return field.type === 'select' ? (
          <View key={field.key} style={{ gap: space.sm }}>
            <Section title={field.required ? label + ' *' : label} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {field.options.map((option) => <Chip key={option} label={option} selected={value === option} onPress={() => change(value === option ? '' : option)} />)}
            </View>
          </View>
        ) : (
          <Field key={field.key} label={label} required={field.required} value={value} onChangeText={change}
            multiline={field.type === 'textarea'} maxLength={field.type === 'textarea' ? 2000 : 250}
            keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'tel' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'} />
        );
      })}
    </View>
  );
}
