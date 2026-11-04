import {
  formLanguage,
  formText,
  formFieldLabel,
  formOptionLabel,
  localizedFormUrl,
} from '../../../web/src/lib/form-language';

describe('Optional Spanish public forms', () => {
  it('keeps English as the default and leaves English wording unchanged', () => {
    expect(formLanguage()).toBe('en');
    expect(formLanguage('unknown')).toBe('en');
    expect(formText('Continue', 'en')).toBe('Continue');
  });

  it('translates standard field labels including older normalized keys', () => {
    expect(
      formFieldLabel({ key: 'firstname', label: 'First name' }, 'es'),
    ).toBe('Nombre');
    expect(
      formFieldLabel(
        { key: 'serviceUnitInterest', label: 'Service unit' },
        'es',
      ),
    ).toBe('Grupos de servicio');
    expect(formText('Continue', 'es')).toBe('Continuar');
  });

  it('uses custom Spanish wording without changing stored field keys', () => {
    const field = {
      key: 'custom-question',
      label: 'A custom question',
      labelEs: 'Una pregunta personalizada',
    };
    expect(formFieldLabel(field, 'es')).toBe('Una pregunta personalizada');
    expect(field.key).toBe('custom-question');
    expect(formFieldLabel(field, 'en')).toBe('A custom question');
  });

  it('translates choice labels while preserving canonical submitted values', () => {
    const field = {
      options: ['Yes', 'No', 'Custom'],
      optionsEs: ['Sí', 'No', 'Personalizado'],
    };
    expect(formOptionLabel(field, field.options[0], 'es')).toBe('Sí');
    expect(formOptionLabel(field, field.options[2], 'es')).toBe(
      'Personalizado',
    );
    expect(field.options).toEqual(['Yes', 'No', 'Custom']);
    expect(formOptionLabel(field, field.options[2], 'en')).toBe('Custom');
  });

  it('generates Spanish links without losing branch or attribution parameters', () => {
    const url = new URL(
      localizedFormUrl(
        'https://www.chuflow.com/intake/member?branchId=123&campaign=outreach',
        'es',
      ),
    );
    expect(url.searchParams.get('lang')).toBe('es');
    expect(url.searchParams.get('branchId')).toBe('123');
    expect(url.searchParams.get('campaign')).toBe('outreach');
    expect(
      new URL(localizedFormUrl(url.href, 'en')).searchParams.has('lang'),
    ).toBe(false);
  });
});
